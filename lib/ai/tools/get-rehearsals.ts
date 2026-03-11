import { createClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/auth/guards";

/**
 * Anthropic tool definition for get_rehearsals.
 */
export const getRehearsalsTool = {
  name: "get_rehearsals",
  description:
    "Look up approved rehearsal schedules. Can filter by student name, student ID, and date range. Returns only approved rehearsals. Default date range is today to 14 days from now.",
  input_schema: {
    type: "object" as const,
    properties: {
      student_name: {
        type: "string",
        description:
          "Student first or last name to search for. Use when the user asks about a specific student.",
      },
      student_id: {
        type: "string",
        description: "Specific student UUID. Use if you already know the student ID.",
      },
      date_from: {
        type: "string",
        description:
          "Start date (YYYY-MM-DD). Defaults to today if not provided.",
      },
      date_to: {
        type: "string",
        description:
          "End date (YYYY-MM-DD). Defaults to 14 days from today if not provided.",
      },
    },
    required: [],
  },
};

interface GetRehearsalsInput {
  student_name?: string;
  student_id?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Execute the get_rehearsals tool with role-based scoping.
 */
export async function executeGetRehearsals(
  input: GetRehearsalsInput,
  user: AuthUser
): Promise<string> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const dateFrom = input.date_from ?? today;
  const dateTo = input.date_to ?? addDays(today, 14);

  // ── 1. Resolve student IDs ───────────────────────────────
  let targetStudentIds: string[] | null = null; // null = no student filter

  if (input.student_id) {
    targetStudentIds = [input.student_id];
  } else if (input.student_name) {
    const nameParts = input.student_name.trim().split(/\s+/);
    let query = supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("active", true);

    if (nameParts.length === 1) {
      // Search first or last name
      const term = `%${nameParts[0]}%`;
      query = query.or(`first_name.ilike.${term},last_name.ilike.${term}`);
    } else {
      // Search first AND last name
      const first = `%${nameParts[0]}%`;
      const last = `%${nameParts.slice(1).join(" ")}%`;
      query = query.ilike("first_name", first).ilike("last_name", last);
    }

    const { data: students, error } = await query;
    if (error) {
      console.error("[get_rehearsals] student search error:", error);
      return "Error searching for student. Please try again.";
    }

    if (!students || students.length === 0) {
      return `No student found matching "${input.student_name}".`;
    }

    // Handle disambiguation
    if (students.length > 5) {
      return `Found ${students.length} students matching "${input.student_name}". Please be more specific — try using a first and last name.`;
    }

    if (students.length > 1) {
      const names = students
        .map((s) => `${s.first_name} ${s.last_name}`)
        .join(", ");
      return `Multiple students found matching "${input.student_name}": ${names}. Which student did you mean?`;
    }

    targetStudentIds = [students[0].id];
  }

  // ── 2. Role-based scoping ────────────────────────────────
  if (user.role === "parent" || user.role === "student") {
    // Parent/student can only see their own children
    const { data: myStudents } = await supabase
      .from("students")
      .select("id")
      .eq("parent_id", user.id);

    const myStudentIds = (myStudents ?? []).map((s) => s.id);
    if (myStudentIds.length === 0) {
      return "No students found on your account.";
    }

    if (targetStudentIds) {
      // Intersect requested with allowed
      targetStudentIds = targetStudentIds.filter((id) =>
        myStudentIds.includes(id)
      );
      if (targetStudentIds.length === 0) {
        return "You can only view rehearsals for your own children.";
      }
    } else {
      targetStudentIds = myStudentIds;
    }
  }

  // ── 3. Get casting → production_dance_ids ────────────────
  let productionDanceIds: string[] | null = null; // null = no pd filter

  if (user.role === "teacher") {
    // Teacher: filter to dances where they are choreographer
    const { data: myDances } = await supabase
      .from("dances")
      .select("id")
      .eq("choreographer_id", user.id);

    const myDanceIds = (myDances ?? []).map((d) => d.id);
    if (myDanceIds.length === 0) {
      return "No dances found for your choreography.";
    }

    const { data: pds } = await supabase
      .from("production_dances")
      .select("id")
      .in("dance_id", myDanceIds);

    productionDanceIds = (pds ?? []).map((pd) => pd.id);
    if (productionDanceIds.length === 0) {
      return "No production dances found for your choreography.";
    }

    // If also filtering by student, further narrow via casting
    if (targetStudentIds) {
      const { data: castings } = await supabase
        .from("casting")
        .select("production_dance_id")
        .in("student_id", targetStudentIds)
        .in("production_dance_id", productionDanceIds);

      productionDanceIds = [
        ...new Set((castings ?? []).map((c) => c.production_dance_id)),
      ];
    }
  } else if (targetStudentIds) {
    // For non-teacher roles with student filter: get casting records
    const { data: castings } = await supabase
      .from("casting")
      .select("production_dance_id")
      .in("student_id", targetStudentIds);

    productionDanceIds = [
      ...new Set((castings ?? []).map((c) => c.production_dance_id)),
    ];
  }

  if (productionDanceIds !== null && productionDanceIds.length === 0) {
    const studentDesc = input.student_name
      ? `for ${input.student_name}`
      : "for the specified criteria";
    return `No rehearsals found ${studentDesc} in the date range ${dateFrom} to ${dateTo}.`;
  }

  // ── 4. Query rehearsals ──────────────────────────────────
  let rehearsalQuery = supabase
    .from("rehearsals")
    .select("*")
    .eq("approval_status", "approved")
    .gte("rehearsal_date", dateFrom)
    .lte("rehearsal_date", dateTo)
    .order("rehearsal_date")
    .order("start_time");

  if (productionDanceIds !== null) {
    rehearsalQuery = rehearsalQuery.in(
      "production_dance_id",
      productionDanceIds
    );
  }

  const { data: rehearsals, error: rErr } = await rehearsalQuery;
  if (rErr) {
    console.error("[get_rehearsals] rehearsal query error:", rErr);
    return "Error looking up rehearsals. Please try again.";
  }

  if (!rehearsals || rehearsals.length === 0) {
    const studentDesc = input.student_name
      ? `for ${input.student_name}`
      : "";
    return `No approved rehearsals found ${studentDesc} from ${dateFrom} to ${dateTo}.`;
  }

  // ── 5. For parent/student: filter to published productions ─
  const pdIdsFromRehearsals = [
    ...new Set(rehearsals.map((r) => r.production_dance_id)),
  ];

  const { data: pdDetails } = await supabase
    .from("production_dances")
    .select("id, dance_id, production_id")
    .in("id", pdIdsFromRehearsals);

  const prodIds = [...new Set((pdDetails ?? []).map((pd) => pd.production_id))];
  const { data: productions } = await supabase
    .from("productions")
    .select("id, name, is_published")
    .in("id", prodIds);

  const prodMap: Record<string, { name: string; is_published: boolean }> = {};
  for (const p of productions ?? []) {
    prodMap[p.id] = { name: p.name, is_published: p.is_published };
  }

  // Build pd → production mapping
  const pdToProd: Record<string, string> = {};
  const pdToDance: Record<string, string> = {};
  for (const pd of pdDetails ?? []) {
    pdToProd[pd.id] = pd.production_id;
    pdToDance[pd.id] = pd.dance_id;
  }

  // For parent/student: only show published productions
  let filteredRehearsals = rehearsals;
  if (user.role === "parent" || user.role === "student") {
    filteredRehearsals = rehearsals.filter((r) => {
      const prodId = pdToProd[r.production_dance_id];
      return prodId && prodMap[prodId]?.is_published;
    });

    if (filteredRehearsals.length === 0) {
      const studentDesc = input.student_name
        ? `for ${input.student_name}`
        : "";
      return `No approved rehearsals found ${studentDesc} from ${dateFrom} to ${dateTo}.`;
    }
  }

  // ── 6. Get dance titles ──────────────────────────────────
  const danceIds = [...new Set(Object.values(pdToDance))];
  const danceNames: Record<string, string> = {};
  if (danceIds.length > 0) {
    const { data: dances } = await supabase
      .from("dances")
      .select("id, title")
      .in("id", danceIds);
    for (const d of dances ?? []) {
      danceNames[d.id] = d.title;
    }
  }

  // ── 7. Format output ────────────────────────────────────
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const lines = filteredRehearsals.map((r) => {
    const date = new Date(r.rehearsal_date + "T00:00:00");
    const dayName = days[date.getDay()];
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const start = formatTime(r.start_time);
    const end = formatTime(r.end_time);

    const danceId = pdToDance[r.production_dance_id];
    const danceTitle = danceId ? (danceNames[danceId] ?? "Unknown Dance") : "Unknown Dance";

    const prodId = pdToProd[r.production_dance_id];
    const prodName = prodId ? (prodMap[prodId]?.name ?? "") : "";

    const location = r.location ?? "TBD";
    const mandatory = r.is_mandatory ? " (mandatory)" : "";
    const type =
      r.rehearsal_type && r.rehearsal_type !== "rehearsal"
        ? ` [${r.rehearsal_type.replace(/_/g, " ")}]`
        : "";

    let line = `${dayName}, ${dateStr} — ${start}–${end} — ${danceTitle} — ${location}${mandatory}${type}`;
    if (prodName) line += `\n  Production: ${prodName}`;
    if (r.notes) line += `\n  Notes: ${r.notes}`;
    if (r.location_address) line += `\n  Address: ${r.location_address}`;
    if (r.location_directions) line += `\n  Directions: ${r.location_directions}`;

    return line;
  });

  return lines.join("\n\n");
}

function formatTime(time: string): string {
  if (!time) return "TBD";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
