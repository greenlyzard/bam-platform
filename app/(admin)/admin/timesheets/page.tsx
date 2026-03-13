import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "./export-csv";
import { TimesheetsClient } from "./timesheets-client";
import Link from "next/link";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  class_lead: "Class",
  class_assistant: "Class (Asst)",
  private: "Private",
  rehearsal: "Rehearsal",
  performance_event: "Performance",
  competition: "Competition",
  training: "Training",
  admin: "Admin",
  substitute: "Substitute",
  bonus: "Other",
};

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    view?: string;
    teacher?: string;
    empType?: string;
    entryType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireRole("finance_admin", "admin", "super_admin");
  const supabase = await createClient();
  const params = await searchParams;
  const filterStatus = params.status || "submitted";
  const view = params.view || "timesheets";

  // Default date range: last month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .split("T")[0];
  const dateFrom = params.from || defaultFrom;
  const dateTo = params.to || defaultTo;

  // Fetch all teachers for dropdown
  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name, employment_type")
    .eq("is_active", true)
    .order("first_name");

  const teachers = (teacherProfiles ?? []).map((tp) => ({
    id: tp.id,
    name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
    employmentType: tp.employment_type,
  }));

  // Fetch productions
  const { data: productionRows } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");

  const productions = (productionRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Fetch timesheets with teacher info
  let tsQuery = supabase
    .from("timesheets")
    .select(
      "id, status, total_hours, submitted_at, reviewed_at, rejection_notes, teacher_id, teacher_profiles(first_name, last_name, email, employment_type)"
    )
    .order("submitted_at", { ascending: false });

  if (filterStatus !== "all") {
    tsQuery = tsQuery.eq("status", filterStatus);
  }

  const { data: timesheets } = await tsQuery;
  const allTimesheets = timesheets ?? [];

  // Count by status for filter tabs
  const { data: allTs } = await supabase
    .from("timesheets")
    .select("status");

  const counts: Record<string, number> = {};
  for (const t of allTs ?? []) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }

  // Fetch entries for each timesheet
  const timesheetIds = allTimesheets.map((t) => t.id);
  const { data: allEntries } =
    timesheetIds.length > 0
      ? await supabase
          .from("timesheet_entries")
          .select(
            "id, timesheet_id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes, status, flag_question, flag_response, flagged_at, approved_at, adjustment_note"
          )
          .in("timesheet_id", timesheetIds)
          .order("date", { ascending: false })
      : { data: [] };

  // Build CSV data
  const csvRows = (allEntries ?? []).map((e) => {
    const ts = allTimesheets.find((t) => t.id === e.timesheet_id);
    const tp = ts?.teacher_profiles as unknown as {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
    return {
      teacher:
        [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || "Unknown",
      email: tp?.email ?? "",
      date: e.date,
      type: e.entry_type,
      hours: e.total_hours,
      description: e.description ?? "",
      status: ts?.status ?? "",
    };
  });

  // For "entries" view, fetch entries with richer data
  let recentEntries: typeof allEntries = [];
  if (view === "entries") {
    let entryQuery = supabase
      .from("timesheet_entries")
      .select(
        "id, timesheet_id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes, status, flag_question, flag_response, flagged_at, approved_at, adjustment_note, timesheets!inner(teacher_id, status, teacher_profiles(first_name, last_name, employment_type))"
      )
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: false })
      .limit(200);

    // Apply filters
    if (params.teacher) {
      entryQuery = entryQuery.eq("timesheets.teacher_id", params.teacher);
    }

    const { data: entries } = await entryQuery;
    recentEntries = entries as typeof allEntries;

    // Client-side filter for empType and entryType since they need join data
    if (params.empType || params.entryType) {
      recentEntries = (recentEntries ?? []).filter((e) => {
        if (params.entryType && e.entry_type !== params.entryType) return false;
        if (params.empType) {
          const ts = (e as Record<string, unknown>).timesheets as {
            teacher_profiles: { employment_type: string } | null;
          } | null;
          const et = ts?.teacher_profiles?.employment_type;
          if (et !== params.empType) return false;
        }
        return true;
      });
    }
  }

  // Fetch change logs for visible entries
  const visibleEntryIds = view === "entries"
    ? (recentEntries ?? []).map((e) => e.id)
    : (allEntries ?? []).map((e) => e.id);

  const { data: changeLogs } =
    visibleEntryIds.length > 0
      ? await supabase
          .from("timesheet_entry_changes")
          .select("id, entry_id, change_type, changed_by_name, field_changed, old_value, new_value, note, created_at")
          .in("entry_id", visibleEntryIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  type ChangeLogRow = { id: string; entry_id: string; change_type: string; changed_by_name: string | null; field_changed: string | null; old_value: string | null; new_value: string | null; note: string | null; created_at: string };
  const changeLogMap: Record<string, ChangeLogRow[]> = {};
  for (const cl of (changeLogs ?? []) as ChangeLogRow[]) {
    if (!changeLogMap[cl.entry_id]) changeLogMap[cl.entry_id] = [];
    changeLogMap[cl.entry_id].push(cl);
  }

  return (
    <TimesheetsClient
      view={view}
      filterStatus={filterStatus}
      dateFrom={dateFrom}
      dateTo={dateTo}
      filterTeacher={params.teacher || ""}
      filterEmpType={params.empType || ""}
      filterEntryType={params.entryType || ""}
      teachers={teachers}
      productions={productions}
      timesheets={allTimesheets.map((ts) => {
        const tp = ts.teacher_profiles as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          employment_type: string;
        } | null;
        return {
          id: ts.id,
          status: ts.status,
          totalHours: ts.total_hours ?? 0,
          submittedAt: ts.submitted_at,
          reviewedAt: ts.reviewed_at,
          rejectionNotes: ts.rejection_notes,
          teacherId: ts.teacher_id,
          teacherName: [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || "Unknown",
          teacherEmail: tp?.email ?? "",
          employmentType: tp?.employment_type ?? "w2",
        };
      })}
      entries={(allEntries ?? []).map((e) => ({
        ...e,
        changes: changeLogMap[e.id] ?? [],
      }))}
      recentEntries={(recentEntries ?? []).map((e) => {
        const ts = (e as Record<string, unknown>).timesheets as {
          teacher_id: string;
          status: string;
          teacher_profiles: {
            first_name: string | null;
            last_name: string | null;
            employment_type: string;
          } | null;
        } | null;
        return {
          ...e,
          teacherId: ts?.teacher_id ?? "",
          teacherName: ts?.teacher_profiles
            ? [ts.teacher_profiles.first_name, ts.teacher_profiles.last_name].filter(Boolean).join(" ")
            : "Unknown",
          timesheetStatus: ts?.status ?? "draft",
          changes: changeLogMap[e.id] ?? [],
        };
      })}
      counts={counts}
      csvRows={csvRows}
      entryTypeLabels={ENTRY_TYPE_LABELS}
    />
  );
}
