import { requireFinance } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PayrollReport } from "./payroll-report";
import {
  classifyEmployment,
  type PayrollClass,
} from "@/lib/timesheets/employment";

// PostgREST caps every response at db-max-rows (default 1000). A query with no
// .range() silently returns the first page and looks complete, so a full-year
// multi-teacher payroll would under-report with no error. Page explicitly.
//
// Advance by the number of rows actually returned rather than by PAGE_SIZE, and
// stop only on an empty page: if the server cap is lower than PAGE_SIZE, a
// short page is the cap, not the end of the data. This costs one extra empty
// request per run and is correct for any cap.
const PAGE_SIZE = 1000;

// Backstop against an unbounded loop if a page ever repeats. Far above any real
// range — a year of studio-wide entries is a few thousand rows.
const MAX_ENTRY_ROWS = 100_000;

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
  // The entire page is a compensation report — every row, total, and export
  // is a pay figure. Guarded at the page boundary rather than per-element.
  await requireFinance();
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

  // Fetch all teacher profiles.
  // teacher_profiles VIEW has no `user_id` — its `id` IS profiles.id
  //
  // Deliberately no rate columns. Pay is read from timesheet_entries.amount_cents,
  // which a BEFORE INSERT/UPDATE trigger snapshots from the rate in effect on the
  // entry's own date. teachers.class_rate_cents and friends are legacy, all NULL,
  // and must never re-enter this path: reading a *current* rate to price *past*
  // work reprices history every time a rate changes.
  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name, email, employment_type, is_active")
    .eq("is_active", true)
    .order("first_name");

  // Fetch productions for filter
  const { data: productionRows } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");

  // ---- Entry fetch, paginated -------------------------------------------
  // Rebuilt per page: a PostgREST query builder is consumed once it is awaited.
  // The order must be total (date is not unique) or pages would overlap and
  // drop rows — id breaks the tie.
  function buildEntryQuery(offset: number) {
    let q = supabase
      .from("timesheet_entries")
      .select(
        "id, timesheet_id, date, entry_type, total_hours, amount_cents, rate_id, description, sub_for, production_id, production_name, event_tag, notes, timesheets!inner(teacher_id, status)"
      )
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (params.production) {
      q = q.eq("production_id", params.production);
    }

    if (params.status === "approved") {
      q = q.eq("timesheets.status", "approved");
    } else if (params.status === "pending") {
      q = q.in("timesheets.status", ["draft", "submitted"]);
    }

    return q;
  }

  type RawEntry = Awaited<ReturnType<typeof buildEntryQuery>>["data"];
  const rawEntries: NonNullable<RawEntry> = [];
  let entryFetchError: string | null = null;
  let truncated = false;

  for (;;) {
    const { data, error } = await buildEntryQuery(rawEntries.length);
    if (error) {
      // Report the partial fetch rather than rendering a low total as if final.
      entryFetchError = error.message;
      break;
    }
    const page = data ?? [];
    if (page.length === 0) break;
    rawEntries.push(...page);
    if (rawEntries.length >= MAX_ENTRY_ROWS) {
      truncated = true;
      break;
    }
  }

  const fetchedRowCount = rawEntries.length;

  // ---- Rate type lookup --------------------------------------------------
  // Only rate_type is needed, to keep flat-rate work out of the HOURS totals
  // (a flat fee is not earned per hour, so adding its hours to an hourly bucket
  // makes the implied rate meaningless). Its amount_cents still counts in full
  // toward dollars.
  //
  // Looked up by id rather than embedded in the entry select: the embed would
  // arrive typed as an array on a many-to-one FK and need casting at every use.
  const rateIds = [
    ...new Set(
      rawEntries
        .map((e) => e.rate_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const rateTypeById = new Map<string, string>();
  let rateLookupError: string | null = null;
  for (let i = 0; i < rateIds.length; i += 500) {
    const { data, error } = await supabase
      .from("teacher_rates")
      .select("id, rate_type")
      .in("id", rateIds.slice(i, i + 500));
    if (error) {
      rateLookupError = error.message;
      break;
    }
    for (const r of data ?? []) rateTypeById.set(r.id, r.rate_type);
  }

  // Map entries to typed structure
  interface PayrollEntry {
    id: string;
    date: string;
    entry_type: string;
    total_hours: number;
    /** NULL means UNPRICED — no rate was in effect. Never coerce to 0. */
    amount_cents: number | null;
    rate_type: string | null;
    description: string | null;
    sub_for: string | null;
    production_id: string | null;
    production_name: string | null;
    event_tag: string | null;
    notes: string | null;
    teacher_profile_id: string;
    timesheet_status: string;
  }

  const entries: PayrollEntry[] = rawEntries.map((e) => {
    const ts = (e as Record<string, unknown>).timesheets as {
      teacher_id: string;
      status: string;
    };
    return {
      id: e.id,
      date: e.date,
      entry_type: e.entry_type,
      total_hours: e.total_hours ?? 0,
      amount_cents: e.amount_cents,
      rate_type: e.rate_id ? rateTypeById.get(e.rate_id) ?? null : null,
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
    payrollClass: PayrollClass;
    hours: {
      class: number;
      private: number;
      rehearsal: number;
      admin: number;
      other: number;
      /** Excludes flat-rate hours. */
      total: number;
    };
    /** Sum of stored amount_cents. Integer cents — never divided until display. */
    totalOwedCents: number;
    /** Entries with amount_cents IS NULL. Their hours ARE in hours.total; their
        dollars are in no total anywhere, because no dollar figure exists. */
    unpriced: { count: number; hours: number };
    /** Flat-rate entries: counted in dollars, held out of hours. */
    flat: { count: number; hours: number };
    entries: PayrollEntry[];
    hasUnpricedEntries: boolean;
  }

  const teacherMap = new Map<string, TeacherPayroll>();

  for (const tp of teacherProfiles ?? []) {
    teacherMap.set(tp.id, {
      id: tp.id,
      name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
      email: tp.email ?? "",
      employmentType: tp.employment_type,
      payrollClass: classifyEmployment(tp.employment_type),
      hours: { class: 0, private: 0, rehearsal: 0, admin: 0, other: 0, total: 0 },
      totalOwedCents: 0,
      unpriced: { count: 0, hours: 0 },
      flat: { count: 0, hours: 0 },
      entries: [],
      hasUnpricedEntries: false,
    });
  }

  // Filter by teacher if specified
  const filterTeacher = params.teacher || "";
  const filterEmpType = params.empType || "";

  // Entries whose teacher is not in teacherMap — the profile is inactive or the
  // view excluded them. Their hours and dollars appear in NO section, so the
  // report would read low with nothing on screen to say so. Counted and warned.
  let unattributedEntryCount = 0;

  for (const entry of entries) {
    const teacher = teacherMap.get(entry.teacher_profile_id);
    if (!teacher) {
      unattributedEntryCount++;
      continue;
    }
    if (filterTeacher && teacher.id !== filterTeacher) continue;
    if (filterEmpType && teacher.payrollClass !== filterEmpType) continue;

    teacher.entries.push(entry);

    const hrs = entry.total_hours;
    const et = entry.entry_type;

    // Dollars come from the stored snapshot, always. No multiplication anywhere
    // on this page — the trigger already did the arithmetic at the rate that
    // was in effect on entry.date.
    if (entry.amount_cents === null) {
      teacher.unpriced.count += 1;
      teacher.unpriced.hours += hrs;
      teacher.hasUnpricedEntries = true;
    } else {
      teacher.totalOwedCents += entry.amount_cents;
    }

    if (entry.rate_type === "flat") {
      teacher.flat.count += 1;
      teacher.flat.hours += hrs;
      continue;
    }

    // Display buckets only. entry_type has ten values and the trailing else is
    // what makes this exhaustive — performance_event, competition, training and
    // bonus land in "other". No dollar figure depends on this mapping, so an
    // unmapped type can no longer contribute 0 or NaN to pay.
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

  // Split into W-2 and 1099
  let allTeachers = Array.from(teacherMap.values()).filter(
    (t) => t.entries.length > 0 || !filterTeacher
  );

  // Apply filters
  if (filterTeacher) {
    allTeachers = allTeachers.filter((t) => t.id === filterTeacher);
  }
  if (filterEmpType) {
    allTeachers = allTeachers.filter((t) => t.payrollClass === filterEmpType);
  }

  // Every teacher lands in exactly one bucket — a teacher with hours must never
  // vanish from the report just because their classification is unmapped.
  const w2Teachers = allTeachers.filter((t) => t.payrollClass === "w2");
  const contractorTeachers = allTeachers.filter((t) => t.payrollClass === "1099");
  const ownerTeachers = allTeachers.filter(
    (t) => t.payrollClass === "owner_draw"
  );
  const unclassifiedTeachers = allTeachers.filter(
    (t) => t.payrollClass === "unclassified"
  );

  // Owner value is computed and displayed but is EXCLUDED from both wage
  // totals — an owner's draw is an equity distribution, not payroll expense.
  // Folding it into either total would misstate labor cost.
  const totalW2OwedCents = w2Teachers.reduce((s, t) => s + t.totalOwedCents, 0);
  const total1099OwedCents = contractorTeachers.reduce(
    (s, t) => s + t.totalOwedCents,
    0
  );
  const totalOwnerDrawCents = ownerTeachers.reduce(
    (s, t) => s + t.totalOwedCents,
    0
  );
  const totalUnclassifiedOwedCents = unclassifiedTeachers.reduce(
    (s, t) => s + t.totalOwedCents,
    0
  );
  const totalHours = allTeachers.reduce((s, t) => s + t.hours.total, 0);

  // Unpriced work, reported on its own line. Never added to a dollar total —
  // there is no amount to add — and never hidden, because it is the difference
  // between the report and what is actually owed.
  const unpricedEntryCount = allTeachers.reduce(
    (s, t) => s + t.unpriced.count,
    0
  );
  const unpricedHours = allTeachers.reduce((s, t) => s + t.unpriced.hours, 0);
  const unpricedTeacherCount = allTeachers.filter(
    (t) => t.unpriced.count > 0
  ).length;

  const flatEntryCount = allTeachers.reduce((s, t) => s + t.flat.count, 0);
  const flatHours = allTeachers.reduce((s, t) => s + t.flat.hours, 0);

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
      ownerTeachers={ownerTeachers}
      unclassifiedTeachers={unclassifiedTeachers}
      totalW2OwedCents={totalW2OwedCents}
      total1099OwedCents={total1099OwedCents}
      totalOwnerDrawCents={totalOwnerDrawCents}
      totalUnclassifiedOwedCents={totalUnclassifiedOwedCents}
      totalHours={totalHours}
      unpricedEntryCount={unpricedEntryCount}
      unpricedHours={unpricedHours}
      unpricedTeacherCount={unpricedTeacherCount}
      flatEntryCount={flatEntryCount}
      flatHours={flatHours}
      fetchedRowCount={fetchedRowCount}
      truncated={truncated}
      entryFetchError={entryFetchError}
      rateLookupError={rateLookupError}
      unattributedEntryCount={unattributedEntryCount}
      teacherList={teacherList}
      productions={productions}
      filterTeacher={filterTeacher}
      filterProduction={params.production || ""}
      filterEmpType={filterEmpType}
      filterStatus={params.status || ""}
    />
  );
}
