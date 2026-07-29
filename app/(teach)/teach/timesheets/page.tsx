import { requireRole } from "@/lib/auth/guards";
import { tenantPayPeriod, tenantToday } from "@/lib/dates";
import {
  computePeriodLock,
  formatPeriodDate,
  payPeriodMonthRange,
} from "@/lib/timesheets/helpers";
import {
  generateTimesheetDrafts,
  fetchAttendanceTakenInstances,
} from "@/lib/timesheets/drafts";
import { createClient } from "@/lib/supabase/server";
import { AddEntryForm, EditEntryRow } from "./entry-form";
import { ConfirmAllDrafts } from "./confirm-drafts";
import { FlagResponseForm } from "./flag-response";

export default async function TimesheetsPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  const now = new Date();
  const monthLabel = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // Pay period resolved in the tenant's zone, matching the lock check in the
  // server actions exactly. Note this is TODAY's period; getOrCreateTimesheet
  // files an entry to the period of the entry's own work date, so a backdated
  // entry deliberately lands on an earlier timesheet than the one shown here.
  const currentPeriod = tenantPayPeriod(user.timezone);

  // Get teacher_profile — VIEW uses `id` (= profiles.id), not `user_id`
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id, employment_type")
    .eq("id", user.id)
    .single();

  const employmentType = teacherProfile?.employment_type ?? "w2";

  // ── Draft generation ──────────────────────────────────────────────────────
  // Runs before the entries are read, so drafts created now appear on this
  // render rather than the next one.
  //
  // Scoped to this teacher and to the month of the period being viewed. The
  // window comes from payPeriodMonthRange, not from a Date the runtime formats:
  // Vercel runs UTC and a locally-formatted boundary would shift by a day.
  //
  // Idempotent by (teacher, schedule_instance_id) in the function itself, so
  // this is safe on every page load — a refresh creates nothing, and an entry
  // the teacher deleted is never resurrected. Nothing here re-implements or
  // works around that; the guarantee lives in SQL on purpose.
  const draftWindow = payPeriodMonthRange(currentPeriod.year, currentPeriod.month);
  const draftResult =
    user.tenantId && teacherProfile
      ? await generateTimesheetDrafts(supabase, {
          tenantId: user.tenantId,
          from: draftWindow.from,
          to: draftWindow.to,
          teacherId: teacherProfile.id,
        })
      : { error: "No tenant or teacher profile — draft generation skipped." };

  // Render never depends on this succeeding. The counts are logged for every
  // load; only a non-zero `created` reaches the page, because "we made nothing
  // because there was nothing to make" is not news to a teacher.
  const draftError = "error" in draftResult ? draftResult.error : null;
  const draftsCreated = "error" in draftResult ? 0 : draftResult.created;
  if (draftError) {
    console.error("[teach:timesheets] draft generation failed:", draftError);
  } else if (!("error" in draftResult)) {
    console.log(
      `[teach:timesheets] drafts for ${teacherProfile?.id} ${draftWindow.from}..${draftWindow.to}:`,
      `created=${draftResult.created}`,
      `skipped_locked=${draftResult.skipped_locked}`,
      `skipped_existing=${draftResult.skipped_existing}`,
      `skipped_no_teacher=${draftResult.skipped_no_teacher}`
    );
  }

  // Fetch productions for dropdown
  const { data: productionRows } = await supabase
    .from("productions")
    .select("id, name")
    .order("name");

  const productions = (productionRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Resolve TODAY's pay period (tenant + month + year). The deadline/cutoff
  // columns come back on this same row — the lock decision reuses it rather
  // than issuing a second identical query.
  const { data: payPeriod } = user.tenantId
    ? await supabase
        .from("pay_periods")
        .select("id, submission_deadline, teacher_edit_cutoff")
        .eq("tenant_id", user.tenantId)
        .eq("period_month", currentPeriod.month)
        .eq("period_year", currentPeriod.year)
        .maybeSingle()
    : { data: null };

  // Same decision function the server actions call, but resolved against THIS
  // period — the actions now resolve against the period of the entry's own work
  // date (resolvePeriodLockForWorkDate). For an entry dated in this period the
  // two agree exactly. For a backdated one they deliberately do not: the form
  // stays open here and the action refuses on the earlier period's cutoff, which
  // is the correct answer for a lock this page cannot know the date of yet.
  const lock = computePeriodLock(
    payPeriod,
    tenantToday(user.timezone),
    user.timezone
  );
  const isLocked = lock.locked;

  // Fetch this teacher's timesheet for the CURRENT pay period only (any status).
  // Scoping by period — rather than newest-by-created_at — is what lets a teacher
  // start a new period after a previous timesheet has been approved. When no
  // timesheet (or no pay period) exists yet, both stay null, isDraft stays true,
  // and AddEntryForm renders so the first entry creates them.
  const { data: timesheet } =
    teacherProfile && payPeriod
      ? await supabase
          .from("timesheets")
          .select("id, status, total_hours, submitted_at")
          .eq("teacher_id", teacherProfile.id)
          .eq("pay_period_id", payPeriod.id)
          .maybeSingle()
      : { data: null };

  // Fetch entries with new fields.
  //
  // The classes join supplies what a generated row cannot say for itself: a
  // draft carries a class_id and times but no description, so without the name
  // it renders as a blank row with hours on it. schedule_instance_id is what
  // distinguishes a proposal from something typed.
  const { data: entriesRaw } = timesheet
    ? await supabase
        .from("timesheet_entries")
        .select(
          "id, date, entry_type, total_hours, description, sub_for, production_id, production_name, event_tag, notes, status, flag_question, flag_response, flagged_at, approved_at, adjustment_note, is_auto_populated, attendance_status, schedule_instance_id, class_id, start_time, end_time, classes(name)"
        )
        .eq("timesheet_id", timesheet.id)
        .order("date", { ascending: false })
    : { data: null };

  // Which occurrences already have attendance recorded. Joined ONLY on
  // schedule_instance_id — see fetchAttendanceTakenInstances for why a
  // (class_id, class_date) match is wrong rather than merely loose. Drives a
  // prompt; never gates confirmation.
  const attendanceTaken = await fetchAttendanceTakenInstances(
    supabase,
    (entriesRaw ?? [])
      .map((e) => e.schedule_instance_id)
      .filter((id): id is string => !!id)
  );

  const entries = (entriesRaw ?? []).map((e) => {
    // Supabase returns a joined relation as an array or an object depending on
    // cardinality — normalise both, never assume the object form.
    const cls = e.classes as unknown as { name: string } | { name: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name ?? null : cls?.name ?? null;
    return {
      ...e,
      className,
      attendanceTaken: e.schedule_instance_id
        ? attendanceTaken.has(e.schedule_instance_id)
        : null,
    };
  });

  const flaggedEntries = entries.filter((e) => e.status === "flagged");

  // Drafts still awaiting a decision. `attendance_status` is null until the
  // teacher confirms; the generator never sets it.
  const unconfirmedDrafts = entries.filter(
    (e) => e.is_auto_populated && !e.attendance_status
  );

  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours ?? 0), 0);
  const timesheetStatus = timesheet?.status ?? "draft";
  const isDraft = timesheetStatus === "draft";
  const canEdit = isDraft && !isLocked;

  const STATUS_BADGES: Record<
    string,
    { bg: string; text: string; label: string }
  > = {
    draft: {
      bg: "bg-lavender/10",
      text: "text-lavender-dark",
      label: "Draft — not yet submitted",
    },
    submitted: {
      bg: "bg-gold/10",
      text: "text-gold-dark",
      label: "Submitted — awaiting review",
    },
    approved: {
      bg: "bg-success/10",
      text: "text-success",
      label: "Approved",
    },
    rejected: {
      bg: "bg-error/10",
      text: "text-error",
      label: "Returned — needs changes",
    },
    exported: {
      bg: "bg-success/10",
      text: "text-success",
      label: "Exported to payroll",
    },
  };

  const badge = STATUS_BADGES[timesheetStatus];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            My Timesheets
          </h1>
          <p className="mt-1 text-sm text-slate">
            {monthLabel} — {totalHours.toFixed(1)} total hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          {badge && entries.length > 0 && (
            <span
              className={`inline-flex items-center rounded-full ${badge.bg} px-3 py-1 text-xs font-medium ${badge.text}`}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      {/* Drafts were just created. Said once, on the load that made them —
          silently adding rows a teacher did not type would read as their own
          forgotten work. */}
      {draftsCreated > 0 && (
        <div className="rounded-lg bg-lavender/10 border border-lavender/20 px-4 py-3 text-sm text-lavender-dark">
          Added <strong>{draftsCreated}</strong>{" "}
          {draftsCreated === 1 ? "entry" : "entries"} from your schedule for{" "}
          {monthLabel}. Review the hours, then confirm — adjust or delete
          anything that did not happen as scheduled.
        </div>
      )}

      {/* Confirm all. Only when something is actually awaiting a decision. */}
      {canEdit && timesheet && unconfirmedDrafts.length > 0 && (
        <ConfirmAllDrafts
          timesheetId={timesheet.id}
          count={unconfirmedDrafts.length}
        />
      )}

      {/* Locked: names the date actually enforced. Previously this said "after
          the 26th" — the submission deadline — while the studio's real edit
          cutoff for July 2026 is August 3. */}
      {isLocked && isDraft && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 text-sm text-warning">
          This pay period closed to edits after{" "}
          <strong>
            {lock.lockDate ? formatPeriodDate(lock.lockDate) : "the cutoff date"}
          </strong>
          . You can still review and submit your timesheet, but entries cannot be
          added or edited.
        </div>
      )}

      {/* Late but still open — a real state, and the one the old copy erased.
          Work done on the 27th–31st belongs in this period and can still be
          entered; the teacher just needs to know they are past due. */}
      {lock.lateButOpen && isDraft && (
        <div className="rounded-lg bg-gold/10 border border-gold/20 px-4 py-3 text-sm text-gold-dark">
          This timesheet was due{" "}
          <strong>
            {lock.submissionDeadline
              ? formatPeriodDate(lock.submissionDeadline)
              : "earlier this period"}
          </strong>
          .{" "}
          {lock.teacherEditCutoff ? (
            <>
              You can still add and edit entries until{" "}
              <strong>{formatPeriodDate(lock.teacherEditCutoff)}</strong> — please
              finish and submit as soon as you can.
            </>
          ) : (
            <>Please finish and submit as soon as you can.</>
          )}
        </div>
      )}

      {/* Flagged entries needing response */}
      {flaggedEntries.length > 0 && (
        <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-5 space-y-4">
          <h3 className="font-heading text-lg font-semibold text-charcoal flex items-center gap-2">
            <span className="text-warning">!</span> Action Needed
          </h3>
          <p className="text-sm text-slate">
            Amanda has questions about the following entries. Please respond below.
          </p>
          {flaggedEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-warning/20 bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal">
                    {entry.description ?? "Entry"} — {entry.total_hours?.toFixed(1)} hrs
                  </p>
                  <p className="text-xs text-slate mt-0.5">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="bg-warning/5 rounded-lg px-3 py-2 border-l-2 border-warning">
                <p className="text-xs text-mist mb-0.5">Amanda&apos;s question:</p>
                <p className="text-sm text-charcoal italic">
                  &ldquo;{entry.flag_question}&rdquo;
                </p>
              </div>
              <FlagResponseForm entryId={entry.id} />
            </div>
          ))}
        </div>
      )}

      {/* Entries table */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No timesheet entries for {monthLabel}. Add your first entry below.
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-silver bg-cloud/50">
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate">
                    Tags
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate">
                    Hours
                  </th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-medium text-slate w-24">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-silver">
                {entries.map((entry) => (
                  <EditEntryRow
                    key={entry.id}
                    entry={entry}
                    locked={!canEdit}
                    employmentType={employmentType}
                    productions={productions}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-silver bg-cloud/30">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm font-medium text-charcoal"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-charcoal">
                    {totalHours.toFixed(1)}
                  </td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Add entry (only in draft) */}
      {isDraft && (
        <AddEntryForm
          locked={isLocked}
          lockedMessage={
            lock.lockDate
              ? `Pay period closed to edits after ${formatPeriodDate(lock.lockDate)}. Entries cannot be added.`
              : undefined
          }
          employmentType={employmentType}
          productions={productions}
        />
      )}

      {/* Submit flow */}
      {timesheet && isDraft && entries.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-semibold text-charcoal">
                Ready to submit?
              </h3>
              <p className="text-sm text-slate mt-1">
                {entries.length}{" "}
                {entries.length === 1 ? "entry" : "entries"} ·{" "}
                {totalHours.toFixed(1)} hours total
                {unconfirmedDrafts.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-gold-dark font-medium">
                      {unconfirmedDrafts.length} unconfirmed
                    </span>
                  </>
                )}
              </p>
            </div>
            <a
              href="/teach/timesheets/summary"
              className="inline-flex items-center h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors"
            >
              Review &amp; Submit
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
