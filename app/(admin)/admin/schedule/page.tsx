import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScheduleInstances, getApprovedTeachers, getRooms, getDistinctLevels } from "@/lib/schedule/queries";
import { ScheduleCalendar } from "./schedule-calendar";

// ── Occurrence coverage ───────────────────────────────────────
// `schedule_instances` rows are generated forward from the season start. Weeks
// outside that generated span get an honest empty state — we do NOT synthesise a
// week from the recurring `classes` rows, because a synthetic week knows nothing
// about closures or per-occurrence cancellations and would confidently show
// classes that are not actually running.
//
// 2026-03-15 → 2026-07-22 is a PERMANENT coverage gap: it predates generation and
// will never have occurrences.
//
// Before the gap sit 61 rows dated 2026-03-09 → 2026-03-14. These are NOT strays
// and must NOT be deleted. They are the disposed orphans from migration
// 20260729000003 — a deliberate append-only artifact, retained on purpose.
// Verified 2026-07-30: all 61 have status='cancelled', class_id NULL, and the note
// "Orphaned occurrence: no class_id. Frozen March 2026 seed week; source class
// unrecoverable. Disposed by docs/OCCURRENCE_GENERATION.md Phase 3."
//
// Those rows are why OCCURRENCE_GAP_END is a constant instead of just reading
// min(event_date): min() returns 2026-03-09, so the notice would claim a range
// spanning the four-month hole. The real generated range starts 2026-07-23, which
// is what we report — the span after the gap, the one that is actually usable.
const OCCURRENCE_GAP_END = "2026-07-22";

async function getGeneratedOccurrenceRange(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  tenantId: string
): Promise<{ start: string; end: string } | null> {
  const [{ data: first }, { data: last }] = await Promise.all([
    supabaseAdmin
      .from("schedule_instances")
      .select("event_date")
      .eq("tenant_id", tenantId)
      .gt("event_date", OCCURRENCE_GAP_END)
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("schedule_instances")
      .select("event_date")
      .eq("tenant_id", tenantId)
      .order("event_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!first || !last) return null;
  return { start: first.event_date, end: last.event_date };
}

function getWeekRange(weekParam?: string): { startDate: string; endDate: string; weekStart: string } {
  let monday: Date;

  if (weekParam) {
    monday = new Date(weekParam + "T00:00:00");
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday = new Date(now);
    monday.setDate(now.getDate() + diff);
  }

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    startDate: fmt(monday),
    endDate: fmt(saturday),
    weekStart: fmt(monday),
  };
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    teacher?: string;
    level?: string;
    room?: string;
    day?: string;
  }>;
}) {
  const user = await requireAdmin();

  const params = await searchParams;
  const { startDate, endDate, weekStart } = getWeekRange(params.week);

  const filterParams = {
    startDate,
    endDate,
    teacherId: params.teacher,
    level: params.level,
    roomId: params.room,
    dayOfWeek: params.day,
    tenantId: user.tenantId ?? undefined,
  };

  const supabaseAdmin = createAdminClient();

  // `getScheduleInstances` returns BOTH sources for the week — class occurrences
  // from `schedule_instances` and private lessons unioned in from
  // `private_sessions` at read time (PRIVATE_ADD_FROM_CALENDAR.md D1). The page
  // no longer fetches or maps privates itself.
  const [instances, teachers, rooms, levels, { data: closureRows }] = await Promise.all([
    getScheduleInstances(filterParams),
    getApprovedTeachers(),
    getRooms(),
    getDistinctLevels(),
    // Range overlap, not start-date containment: a closure is in view when it
    // begins on or before the last day shown and ends on or after the first.
    // `closed_through` is NOT NULL as of migration 20260730000001.
    supabaseAdmin
      .from("studio_closures")
      .select("closed_date, closed_through, is_total, reason")
      .eq("tenant_id", "84d98f72-c82f-414f-8b17-172b802f6993")
      .lte("closed_date", endDate)
      .gte("closed_through", startDate),
  ]);

  // "No occurrences" is a statement about the CLASS grid only — see the
  // OCCURRENCE_GAP_END note above. Privates are real rows from a different
  // table and still render in a week that has no generated class occurrences,
  // so they must not suppress the notice.
  const classInstanceCount = instances.filter((i) => i.event_type !== "private_lesson").length;
  const generatedRange =
    classInstanceCount === 0
      ? await getGeneratedOccurrenceRange(supabaseAdmin, "84d98f72-c82f-414f-8b17-172b802f6993")
      : null;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <ScheduleCalendar
          instances={instances}
          teachers={teachers}
          rooms={rooms}
          levels={levels}
          weekStart={weekStart}
          noOccurrences={classInstanceCount === 0}
          generatedRange={generatedRange}
          closures={(closureRows ?? []).map(c => ({
            closed_date: c.closed_date,
            closed_through: c.closed_through,
            is_total: c.is_total,
            reason: c.reason ?? "Closed",
          }))}
          initialFilters={{
            teacher: params.teacher || "",
            level: params.level || "",
            room: params.room || "",
            day: params.day || "",
          }}
        />
      </div>
    </div>
  );
}
