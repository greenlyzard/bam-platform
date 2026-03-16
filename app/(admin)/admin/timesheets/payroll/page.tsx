import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PayrollReport } from "./payroll-report";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    teacher?: string;
    production?: string;
    empType?: string;
    status?: string;
  }>;
}) {
  await requireRole("finance_admin", "admin", "super_admin");
  const supabase = await createClient();
  const params = await searchParams;

  // Default to current month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const dateFrom = params.from || defaultFrom;
  const dateTo = params.to || defaultTo;

  // Fetch all teacher profiles with pay rates from teachers table
  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name, email, employment_type, user_id, is_active")
    .eq("is_active", true)
    .order("first_name");

  // Fetch legacy pay rates from teachers table (keyed by user_id = profiles.id)
  const userIds = (teacherProfiles ?? []).map((tp) => tp.user_id);
  const { data: teacherRates } =
    userIds.length > 0
      ? await supabase
          .from("teachers")
          .select(
            "id, class_rate_cents, private_rate_cents, rehearsal_rate_cents, admin_rate_cents"
          )
          .in("id", userIds)
      : { data: [] };

  const rateMap: Record<
    string,
    {
      class: number;
      private: number;
      rehearsal: number;
      admin: number;
    }
  > = {};
  for (const tr of teacherRates ?? []) {
    rateMap[tr.id] = {
      class: (tr.class_rate_cents ?? 0) / 100,
      private: (tr.private_rate_cents ?? 0) / 100,
      rehearsal: (tr.rehearsal_rate_cents ?? 0) / 100,
      admin: (tr.admin_rate_cents ?? 0) / 100,
    };
  }

  // Fetch productions for filter
  const { data: productionRows } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");

  // Fetch entries in date range
  let entryQuery = supabase
    .from("timesheet_entries")
    .select(
      "id, timesheet_id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes, timesheets!inner(teacher_id, status)"
    )
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (params.production) {
    entryQuery = entryQuery.eq("production_id", params.production);
  }

  if (params.status === "approved") {
    entryQuery = entryQuery.eq("timesheets.status", "approved");
  } else if (params.status === "pending") {
    entryQuery = entryQuery.in("timesheets.status", ["draft", "submitted"]);
  }

  const { data: rawEntries } = await entryQuery;

  // Map entries to typed structure
  interface PayrollEntry {
    id: string;
    date: string;
    entry_type: string;
    total_hours: number;
    description: string | null;
    sub_for: string | null;
    production_id: string | null;
    production_name: string | null;
    event_tag: string | null;
    notes: string | null;
    teacher_profile_id: string;
    timesheet_status: string;
  }

  const entries: PayrollEntry[] = (rawEntries ?? []).map((e) => {
    const ts = (e as Record<string, unknown>).timesheets as {
      teacher_id: string;
      status: string;
    };
    return {
      id: e.id,
      date: e.date,
      entry_type: e.entry_type,
      total_hours: e.total_hours ?? 0,
      description: e.description,
      sub_for: e.sub_for,
      production_id: e.production_id,
      production_name: e.production_name,
      event_tag: e.event_tag,
      notes: e.notes,
      teacher_profile_id: ts.teacher_id,
      timesheet_status: ts.status,
    };
  });

  // Build teacher payroll data
  interface TeacherPayroll {
    id: string;
    name: string;
    email: string;
    employmentType: string;
    rates: { class: number; private: number; rehearsal: number; admin: number } | null;
    hours: {
      class: number;
      private: number;
      rehearsal: number;
      admin: number;
      other: number;
      total: number;
    };
    totalOwed: number;
    entries: PayrollEntry[];
    hasMissingRates: boolean;
  }

  const teacherMap = new Map<string, TeacherPayroll>();

  for (const tp of teacherProfiles ?? []) {
    const rates = rateMap[tp.user_id] ?? null;
    teacherMap.set(tp.user_id, {
      id: tp.id,
      name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
      email: tp.email ?? "",
      employmentType: tp.employment_type,
      rates,
      hours: { class: 0, private: 0, rehearsal: 0, admin: 0, other: 0, total: 0 },
      totalOwed: 0,
      entries: [],
      hasMissingRates: !rates || (rates.class === 0 && rates.private === 0 && rates.rehearsal === 0 && rates.admin === 0),
    });
  }

  // Filter by teacher if specified
  const filterTeacher = params.teacher || "";
  const filterEmpType = params.empType || "";

  for (const entry of entries) {
    const teacher = teacherMap.get(entry.teacher_profile_id);
    if (!teacher) continue;
    if (filterTeacher && teacher.id !== filterTeacher) continue;
    if (filterEmpType && teacher.employmentType !== filterEmpType) continue;

    teacher.entries.push(entry);

    const hrs = entry.total_hours;
    const et = entry.entry_type;

    if (et === "class_lead" || et === "class_assistant" || et === "substitute") {
      teacher.hours.class += hrs;
    } else if (et === "private") {
      teacher.hours.private += hrs;
    } else if (et === "rehearsal") {
      teacher.hours.rehearsal += hrs;
    } else if (et === "admin") {
      teacher.hours.admin += hrs;
    } else {
      teacher.hours.other += hrs;
    }
    teacher.hours.total += hrs;
  }

  // Calculate totals owed
  for (const teacher of teacherMap.values()) {
    if (teacher.rates) {
      teacher.totalOwed =
        teacher.hours.class * teacher.rates.class +
        teacher.hours.private * teacher.rates.private +
        teacher.hours.rehearsal * teacher.rates.rehearsal +
        teacher.hours.admin * teacher.rates.admin +
        teacher.hours.other * teacher.rates.admin; // other uses admin rate
    }
  }

  // Split into W-2 and 1099
  let allTeachers = Array.from(teacherMap.values()).filter(
    (t) => t.entries.length > 0 || !filterTeacher
  );

  // Apply filters
  if (filterTeacher) {
    allTeachers = allTeachers.filter((t) => t.id === filterTeacher);
  }
  if (filterEmpType) {
    allTeachers = allTeachers.filter((t) => t.employmentType === filterEmpType);
  }

  const w2Teachers = allTeachers.filter((t) => t.employmentType === "w2");
  const contractorTeachers = allTeachers.filter((t) => t.employmentType === "1099");

  const missingRatesCount = allTeachers.filter((t) => t.hasMissingRates && t.entries.length > 0).length;

  const totalW2Owed = w2Teachers.reduce((s, t) => s + t.totalOwed, 0);
  const total1099Owed = contractorTeachers.reduce((s, t) => s + t.totalOwed, 0);
  const totalHours = allTeachers.reduce((s, t) => s + t.hours.total, 0);

  const productions = (productionRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const teacherList = (teacherProfiles ?? []).map((tp) => ({
    id: tp.id,
    name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
  }));

  return (
    <PayrollReport
      dateFrom={dateFrom}
      dateTo={dateTo}
      w2Teachers={w2Teachers}
      contractorTeachers={contractorTeachers}
      totalW2Owed={totalW2Owed}
      total1099Owed={total1099Owed}
      totalHours={totalHours}
      missingRatesCount={missingRatesCount}
      teacherList={teacherList}
      productions={productions}
      filterTeacher={filterTeacher}
      filterProduction={params.production || ""}
      filterEmpType={filterEmpType}
      filterStatus={params.status || ""}
    />
  );
}
