import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AngelinaRole = "public" | "parent" | "teacher" | "admin";

export interface AngelinaContext {
  role: AngelinaRole;
  systemPrompt: string;
  userId?: string;
}

/**
 * Master context builder — call before every Anthropic API request.
 * Assembles a system prompt with live data from the database.
 */
export async function buildAngelinaContext(
  role: AngelinaRole,
  userId?: string,
  tenantId?: string
): Promise<AngelinaContext> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  switch (role) {
    case "public":
      return buildPublicContext(supabase, tenantId!, today, dayOfWeek);
    case "parent":
      return buildParentContext(supabase, userId!, tenantId!, today, dayOfWeek);
    case "teacher":
      return buildTeacherContext(
        supabase,
        userId!,
        tenantId!,
        today,
        dayOfWeek
      );
    case "admin":
      return buildAdminContext(supabase, userId!, tenantId!, today, dayOfWeek);
  }
}

// ── Helpers ──────────────────────────────────────────────────

function formatTime(time: string): string {
  if (!time) return "TBD";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Public Context ───────────────────────────────────────────

async function buildPublicContext(
  supabase: SupabaseClient,
  tenantId: string,
  today: string,
  dayOfWeek: string
): Promise<AngelinaContext> {
  // Fetch active classes
  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, style, level, age_min, age_max, day_of_week, start_time, end_time, max_students, enrolled_count, status, fee_cents, notes, teacher_id"
    )
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  // Get teacher names
  const teacherIds = [
    ...new Set(
      (classes ?? []).map((c) => c.teacher_id).filter(Boolean) as string[]
    ),
  ];
  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name]
        .filter(Boolean)
        .join(" ");
    }
  }

  // Get teacher bios
  const { data: teacherRows } = await supabase
    .from("teachers")
    .select("id, bio, specialties")
    .in("id", teacherIds);

  const teacherBios: Record<string, { bio: string; specialties: string[] }> =
    {};
  for (const t of teacherRows ?? []) {
    teacherBios[t.id] = { bio: t.bio ?? "", specialties: t.specialties ?? [] };
  }

  // Format class list (cap at 30 for token budget)
  const classLines = (classes ?? []).slice(0, 30).map((c) => {
    const day = DAYS[c.day_of_week] ?? "TBD";
    const time = `${formatTime(c.start_time)}–${formatTime(c.end_time)}`;
    const teacher = c.teacher_id ? teacherNames[c.teacher_id] ?? "" : "";
    const ages =
      c.age_min && c.age_max ? `Ages ${c.age_min}–${c.age_max}` : "";
    const fee = c.fee_cents ? `$${(c.fee_cents / 100).toFixed(0)}/month` : "";
    const spots =
      c.max_students && c.enrolled_count !== null
        ? `${Math.max(0, c.max_students - c.enrolled_count)} spots available`
        : "";
    const status = c.status === "full" ? "FULL" : c.status === "waitlist" ? "WAITLIST" : "";
    return `- ${c.name} (${c.level}) | ${day} ${time} | ${ages} | ${teacher} | ${fee} | ${spots} ${status}`.trim();
  });

  // Format teacher list
  const teacherLines = teacherIds.map((id) => {
    const name = teacherNames[id] ?? "Unknown";
    const info = teacherBios[id];
    const bio = info?.bio ? ` — ${info.bio.slice(0, 120)}` : "";
    return `- ${name}${bio}`;
  });

  const systemPrompt = `You are Angelina, the AI assistant for Ballet Academy and Movement — a classical ballet studio in San Clemente, California, founded by professional ballerina Amanda Cobb.

Today is ${dayOfWeek}, ${today}.

Your role: Help prospective parents understand our programs, find the right class for their child, and book a trial class. You are warm, knowledgeable, and passionate about ballet education.

IMPORTANT RULES:
- Never make up class times, prices, or availability — use only the data below
- Never badmouth competing studios
- If a parent asks something you don't know, offer to connect them with the studio: dance@bamsocal.com or (949) 229-0846
- Always offer a trial class as the next step
- After several messages, naturally ask for their name, child's age, and email so you can send them the schedule
- Never abbreviate the studio as "BAM" — always say "Ballet Academy and Movement"
- Keep responses conversational and concise — 2–4 sentences is ideal
- If asked, acknowledge you are an AI assistant for the studio

CURRENT CLASS OFFERINGS:
${classLines.join("\n") || "Please contact us for current class availability."}

TEACHERS:
${teacherLines.join("\n") || "Our experienced team of instructors brings professional-level training to every class."}

STUDIO INFO:
Address: 400-C Camino De Estrella, San Clemente, CA 92672
Phone: (949) 229-0846
Email: dance@bamsocal.com
Website: balletacademyandmovement.com

KEY DIFFERENTIATORS:
- Professional ballet pedagogy (Amanda Cobb — former professional ballerina)
- Small class sizes (max 10 students)
- Three-time Best Dance School in San Clemente
- San Clemente Hall of Fame recognition
- Students accepted to Royal Ballet, ABT, and Stuttgart Ballet intensives
- Major productions: The Nutcracker, spring recital
- Nurturing culture — not a competition factory

TRIAL CLASSES:
First class is always free — no commitment, no pressure. Parents can book a trial by contacting us or through the website.

PLACEMENT GUIDANCE:
- Ages 3-4: Petites
- Ages 5-7, no experience: Level 1
- Ages 5-7, some experience: Level 2A
- Ages 8-10, no experience: Level 2A
- Ages 8-10, experienced: Level 2B or 2C
- Ages 10-13: Level 3A-3C based on experience
- Ages 13+: Level 4B-4C based on experience
- When unsure: recommend a free assessment class`;

  return { role: "public", systemPrompt };
}

// ── Parent Context ───────────────────────────────────────────

async function buildParentContext(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  today: string,
  dayOfWeek: string
): Promise<AngelinaContext> {
  // Get parent profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();
  const parentName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Parent";

  // Get children
  const { data: children } = await supabase
    .from("students")
    .select("id, first_name, last_name, date_of_birth, current_level, age_group, medical_notes")
    .eq("parent_id", userId)
    .eq("active", true);

  const studentIds = (children ?? []).map((c) => c.id);

  // Get enrollments with class details
  let enrollmentLines: string[] = [];
  if (studentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(
        "student_id, status, classes(name, style, level, day_of_week, start_time, end_time, room, teacher_id)"
      )
      .in("student_id", studentIds)
      .in("status", ["active", "trial"]);

    // Get teacher names for enrolled classes
    const tIds = [
      ...new Set(
        (enrollments ?? [])
          .map((e: any) => e.classes?.teacher_id)
          .filter(Boolean) as string[]
      ),
    ];
    const tNames: Record<string, string> = {};
    if (tIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", tIds);
      for (const p of profiles ?? []) {
        tNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
      }
    }

    enrollmentLines = (enrollments ?? []).map((e: any) => {
      const child = (children ?? []).find((c) => c.id === e.student_id);
      const cls = e.classes;
      if (!cls) return `- Unknown class`;
      const day = DAYS[cls.day_of_week] ?? "TBD";
      const time = `${formatTime(cls.start_time)}–${formatTime(cls.end_time)}`;
      const teacher = cls.teacher_id ? tNames[cls.teacher_id] ?? "" : "";
      return `- ${child?.first_name ?? "Student"}: ${cls.name} | ${day} ${time} | ${teacher} | Room: ${cls.room ?? "TBD"} | Status: ${e.status}`;
    });
  }

  // Get upcoming schedule instances (next 14 days)
  const twoWeeksOut = addDays(today, 14);
  let scheduleLines: string[] = [];
  if (studentIds.length > 0) {
    // Get class IDs from enrollments
    const { data: enrolledClasses } = await supabase
      .from("enrollments")
      .select("class_id")
      .in("student_id", studentIds)
      .in("status", ["active", "trial"]);

    const classIds = [
      ...new Set((enrolledClasses ?? []).map((e) => e.class_id)),
    ];

    if (classIds.length > 0) {
      const { data: instances } = await supabase
        .from("schedule_instances")
        .select(
          "event_date, start_time, end_time, status, event_type, notes, class_id, substitute_teacher_id, classes(name)"
        )
        .in("class_id", classIds)
        .gte("event_date", today)
        .lte("event_date", twoWeeksOut)
        .in("status", ["published", "approved", "notified"])
        .order("event_date")
        .order("start_time")
        .limit(20);

      scheduleLines = (instances ?? []).map((i: any) => {
        const date = new Date(i.event_date + "T00:00:00");
        const dayName = DAYS[date.getDay()];
        const dateStr = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const time = `${formatTime(i.start_time)}–${formatTime(i.end_time)}`;
        const className = i.classes?.name ?? "Class";
        const flags = [];
        if (i.status === "cancelled") flags.push("CANCELLED");
        if (i.substitute_teacher_id) flags.push("Substitute teacher");
        if (i.notes) flags.push(i.notes);
        const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
        return `- ${dayName}, ${dateStr}: ${className} ${time}${flagStr}`;
      });
    }
  }

  // Get recent attendance (last 4 weeks)
  let attendanceLines: string[] = [];
  if (studentIds.length > 0) {
    const fourWeeksAgo = addDays(today, -28);
    const { data: attendance } = await supabase
      .from("attendance")
      .select("student_id, class_date, status, classes(name)")
      .in("student_id", studentIds)
      .gte("class_date", fourWeeksAgo)
      .order("class_date", { ascending: false })
      .limit(30);

    const byStudent: Record<string, { present: number; total: number }> = {};
    for (const a of attendance ?? []) {
      if (!byStudent[a.student_id]) {
        byStudent[a.student_id] = { present: 0, total: 0 };
      }
      byStudent[a.student_id].total++;
      if (a.status === "present" || a.status === "late") {
        byStudent[a.student_id].present++;
      }
    }

    attendanceLines = Object.entries(byStudent).map(([sid, stats]) => {
      const child = (children ?? []).find((c) => c.id === sid);
      const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      return `- ${child?.first_name ?? "Student"}: ${stats.present}/${stats.total} classes attended (${pct}%) — last 4 weeks`;
    });
  }

  // Format children info
  const childLines = (children ?? []).map((c) => {
    const age = c.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(c.date_of_birth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : "Unknown";
    return `- ${c.first_name} ${c.last_name} | Age: ${age} | Level: ${c.current_level ?? "Not assigned"}`;
  });

  const systemPrompt = `You are Angelina, the AI assistant for Ballet Academy and Movement.

Today is ${dayOfWeek}, ${today}.

You are speaking with ${parentName}, parent of:
${childLines.join("\n") || "No dancers on file yet."}

YOUR ROLE: Help ${parentName} with questions about their dancers' classes, schedules, rehearsals, and studio information. Be warm, specific, and always use the children's actual names.

RULES:
- Only discuss data related to their own children — never mention other students
- For billing disputes or class changes, direct them to Amanda: dance@bamsocal.com
- For schedule changes, remind them to check the portal for the most current info
- Never discuss other families' information
- Never abbreviate the studio as "BAM"
- Keep responses warm and concise

ENROLLED CLASSES:
${enrollmentLines.join("\n") || "No active enrollments found."}

UPCOMING SCHEDULE (next 14 days):
${scheduleLines.join("\n") || "No upcoming classes found in the next two weeks."}

RECENT ATTENDANCE (last 4 weeks):
${attendanceLines.join("\n") || "No attendance records available."}

STUDIO INFO:
Address: 400-C Camino De Estrella, San Clemente, CA 92672
Phone: (949) 229-0846
Email: dance@bamsocal.com`;

  return { role: "parent", systemPrompt, userId };
}

// ── Teacher Context ──────────────────────────────────────────

async function buildTeacherContext(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  today: string,
  dayOfWeek: string
): Promise<AngelinaContext> {
  // Get teacher profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();
  const teacherName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Teacher";

  const todayDow = new Date().getDay();

  // Get teacher's classes
  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, style, level, day_of_week, start_time, end_time, room, max_students, enrolled_count"
    )
    .eq("teacher_id", userId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  // Today's classes
  const todaysClasses = (classes ?? []).filter(
    (c) => c.day_of_week === todayDow
  );

  // Format today's schedule
  const todayLines = todaysClasses.map((c) => {
    const time = `${formatTime(c.start_time)}–${formatTime(c.end_time)}`;
    return `- ${c.name} | ${time} | Room: ${c.room ?? "TBD"} | ${c.enrolled_count ?? 0}/${c.max_students} enrolled`;
  });

  // Weekly schedule
  const weeklyLines = (classes ?? []).map((c) => {
    const day = DAYS[c.day_of_week] ?? "TBD";
    const time = `${formatTime(c.start_time)}–${formatTime(c.end_time)}`;
    return `- ${day}: ${c.name} (${c.level}) | ${time} | Room: ${c.room ?? "TBD"}`;
  });

  // Get rosters for each class (student names only, no contact info)
  const classIds = (classes ?? []).map((c) => c.id);
  let rosterLines: string[] = [];
  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id, students(first_name, last_name, current_level, date_of_birth)")
      .in("class_id", classIds)
      .in("status", ["active", "trial"]);

    // Group by class
    const byClass: Record<string, string[]> = {};
    for (const e of enrollments ?? []) {
      const student = (e as any).students;
      if (!student) continue;
      if (!byClass[e.class_id]) byClass[e.class_id] = [];
      byClass[e.class_id].push(`${student.first_name} ${student.last_name}`);
    }

    for (const cls of classes ?? []) {
      const students = byClass[cls.id] ?? [];
      if (students.length > 0) {
        rosterLines.push(
          `${cls.name}: ${students.join(", ")} (${students.length} students)`
        );
      }
    }
  }

  // Get hours logged this week
  const weekStart = addDays(today, -new Date().getDay()); // Sunday
  const { data: hours } = await supabase
    .from("teacher_hours")
    .select("date, hours, category, approved")
    .eq("teacher_id", userId)
    .gte("date", weekStart)
    .lte("date", today);

  const totalHours = (hours ?? []).reduce(
    (sum, h) => sum + parseFloat(String(h.hours)),
    0
  );
  const approvedHours = (hours ?? [])
    .filter((h) => h.approved)
    .reduce((sum, h) => sum + parseFloat(String(h.hours)), 0);

  // Get open substitute requests for teacher's classes
  let subLines: string[] = [];
  if (classIds.length > 0) {
    const { data: subRequests } = await supabase
      .from("substitute_requests")
      .select("id, reason, status, schedule_instances(event_date, start_time, end_time, classes(name))")
      .eq("requesting_teacher_id", userId)
      .eq("status", "open");

    subLines = (subRequests ?? []).map((s: any) => {
      const inst = s.schedule_instances;
      const className = inst?.classes?.name ?? "Class";
      const date = inst?.event_date ?? "TBD";
      return `- ${className} on ${date}: ${s.reason ?? "No reason given"} (${s.status})`;
    });
  }

  const systemPrompt = `You are Angelina, the AI assistant for Ballet Academy and Movement.

Today is ${dayOfWeek}, ${today}. You are speaking with ${teacherName}.

YOUR ROLE: Help ${teacherName} with their teaching schedule, student information, hour logging, substitute requests, and studio operations. Be precise and professional.

RULES:
- Only discuss students enrolled in ${teacherName}'s classes
- Never share another teacher's schedule, compensation, or student details
- Never share parent contact information — teachers communicate through the portal
- For administrative decisions (casting changes, level promotions), direct to Amanda
- Remind teacher to log hours if today has classes not yet logged
- Never abbreviate the studio as "BAM"

${teacherName}'s SCHEDULE TODAY (${dayOfWeek}):
${todayLines.join("\n") || "No classes scheduled today."}

FULL WEEKLY SCHEDULE:
${weeklyLines.join("\n") || "No classes assigned."}

STUDENT ROSTERS:
${rosterLines.join("\n") || "No enrolled students found."}

HOUR LOGGING STATUS (this week):
Total logged: ${totalHours.toFixed(1)} hours (${approvedHours.toFixed(1)} approved)
${(hours ?? []).length === 0 ? "No hours logged this week yet." : ""}

OPEN SUBSTITUTE REQUESTS:
${subLines.join("\n") || "None"}

STUDIO CONTACT:
Phone: (949) 229-0846
Email: dance@bamsocal.com`;

  return { role: "teacher", systemPrompt, userId };
}

// ── Admin Context ────────────────────────────────────────────

async function buildAdminContext(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  today: string,
  dayOfWeek: string
): Promise<AngelinaContext> {
  // Get admin name
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();
  const adminName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Admin";

  const todayDow = new Date().getDay();

  // Enrollment totals
  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const { count: totalEnrollments } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "trial"]);

  // Classes with capacity
  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, level, day_of_week, start_time, end_time, max_students, enrolled_count, status, teacher_id, room"
    )
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  // Get teacher names
  const teacherIds = [
    ...new Set(
      (classes ?? []).map((c) => c.teacher_id).filter(Boolean) as string[]
    ),
  ];
  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name]
        .filter(Boolean)
        .join(" ");
    }
  }

  // Today's classes
  const todaysClasses = (classes ?? []).filter(
    (c) => c.day_of_week === todayDow
  );
  const todayLines = todaysClasses.map((c) => {
    const time = `${formatTime(c.start_time)}–${formatTime(c.end_time)}`;
    const teacher = c.teacher_id ? teacherNames[c.teacher_id] ?? "Unassigned" : "Unassigned";
    return `- ${c.name} | ${time} | ${teacher} | Room: ${c.room ?? "TBD"} | ${c.enrolled_count ?? 0}/${c.max_students}`;
  });

  // Teachers on today
  const todayTeacherIds = [
    ...new Set(todaysClasses.map((c) => c.teacher_id).filter(Boolean) as string[]),
  ];
  const todayTeachers = todayTeacherIds.map(
    (id) => teacherNames[id] ?? "Unknown"
  );

  // Enrollment by level
  const levelCounts: Record<string, number> = {};
  for (const c of classes ?? []) {
    const enrolled = c.enrolled_count ?? 0;
    levelCounts[c.level] = (levelCounts[c.level] ?? 0) + enrolled;
  }
  const levelLines = Object.entries(levelCounts).map(
    ([level, count]) => `- ${level}: ${count} students`
  );

  // Capacity status
  const fullClasses = (classes ?? []).filter(
    (c) => (c.enrolled_count ?? 0) >= c.max_students
  );
  const nearFullClasses = (classes ?? []).filter(
    (c) =>
      (c.enrolled_count ?? 0) >= c.max_students - 2 &&
      (c.enrolled_count ?? 0) < c.max_students
  );

  // Open sub requests
  const { data: subRequests } = await supabase
    .from("substitute_requests")
    .select("id, reason, status, schedule_instances(event_date, classes(name)), teachers!substitute_requests_requesting_teacher_id_fkey(id)")
    .eq("status", "open")
    .limit(10);

  const subLines = (subRequests ?? []).map((s: any) => {
    const className = s.schedule_instances?.classes?.name ?? "Class";
    const date = s.schedule_instances?.event_date ?? "TBD";
    return `- ${className} on ${date}: ${s.reason ?? "No reason"} (OPEN)`;
  });

  // Pending approval tasks
  const { count: pendingApprovals } = await supabase
    .from("approval_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // New leads this week (from angelina_conversations)
  const weekStart = addDays(today, -7);
  const { data: leads } = await supabase
    .from("angelina_conversations")
    .select("lead_name, lead_email, lead_child_age, created_at")
    .eq("role", "public")
    .not("lead_email", "is", null)
    .gte("created_at", weekStart)
    .order("created_at", { ascending: false })
    .limit(10);

  const leadLines = (leads ?? []).map((l) => {
    return `- ${l.lead_name ?? "Unknown"} | Child age: ${l.lead_child_age ?? "?"} | ${l.lead_email}`;
  });

  // Teachers with incomplete onboarding
  const { data: incompleteTeachers } = await supabase
    .from("teachers")
    .select("id, w9_on_file, background_check_complete, is_mandated_reporter_certified")
    .or("w9_on_file.eq.false,background_check_complete.eq.false,is_mandated_reporter_certified.eq.false");

  const incompleteIds = (incompleteTeachers ?? []).map((t) => t.id);
  let incompleteTeacherLines: string[] = [];
  if (incompleteIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", incompleteIds);
    incompleteTeacherLines = (profiles ?? []).map((p) => {
      const t = (incompleteTeachers ?? []).find((t) => t.id === p.id);
      const missing = [];
      if (t && !t.w9_on_file) missing.push("W9");
      if (t && !t.background_check_complete) missing.push("Background check");
      if (t && !t.is_mandated_reporter_certified) missing.push("Mandated reporter cert");
      return `- ${p.first_name} ${p.last_name}: Missing ${missing.join(", ")}`;
    });
  }

  // Mandated reporter incidents (count only)
  const { count: openIncidents } = await supabase
    .from("mandated_reporter_incidents")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending_review", "acknowledged"]);

  const systemPrompt = `You are Angelina, the AI assistant for Ballet Academy and Movement.

Today is ${dayOfWeek}, ${today}. You are speaking with ${adminName} (Administrator).

YOUR ROLE: Help ${adminName} manage the studio. You have access to complete studio data. Be direct, precise, and flag anything that needs attention.

RULES:
- Flag urgent items (open sub requests, overdue billing, incomplete onboarding) proactively
- For legal/HR questions, recommend consulting an advisor — don't give legal advice
- For parent complaints, recommend Amanda handle directly
- Never abbreviate the studio as "BAM"

STUDIO SNAPSHOT:
Total Active Students: ${totalStudents ?? 0}
Active Enrollments: ${totalEnrollments ?? 0}
Classes Running Today: ${todaysClasses.length}
Open Substitute Requests: ${subLines.length}
Pending Approval Tasks: ${pendingApprovals ?? 0}
Open Mandated Reporter Incidents: ${openIncidents ?? 0}
Teachers On Schedule Today: ${todayTeachers.join(", ") || "None"}

ENROLLMENT BY LEVEL:
${levelLines.join("\n") || "No enrollment data."}

TODAY'S SCHEDULE (${dayOfWeek}):
${todayLines.join("\n") || "No classes today."}

CLASS CAPACITY ALERTS:
Full classes (${fullClasses.length}): ${fullClasses.map((c) => c.name).join(", ") || "None"}
Near-full classes (${nearFullClasses.length}): ${nearFullClasses.map((c) => c.name).join(", ") || "None"}

OPEN SUBSTITUTE REQUESTS:
${subLines.join("\n") || "None"}

NEW LEADS THIS WEEK:
${leadLines.join("\n") || "No new leads this week."}

TEACHER ONBOARDING GAPS:
${incompleteTeacherLines.join("\n") || "All teachers have complete documentation."}

STUDIO CONTACT:
Phone: (949) 229-0846
Email: dance@bamsocal.com`;

  return { role: "admin", systemPrompt, userId };
}
