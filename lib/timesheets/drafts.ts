import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side wrapper for `generate_timesheet_drafts` (20260728000007).
 *
 * ONE module for both callers — the teacher timesheet page on load and the
 * nightly cron. The generator itself is a Postgres function precisely so those
 * two cannot diverge; putting the call behind one wrapper keeps the argument
 * shape and the failure contract from diverging either.
 *
 * What this deliberately does NOT do: decide what to draft, skip what exists,
 * respect a deletion, or price anything. All of that lives in the function and
 * the snapshot trigger. Application code must never write `amount_cents`.
 */

/** One row, matching the function's RETURNS TABLE signature exactly. */
export interface DraftCounts {
  created: number;
  skipped_locked: number;
  skipped_existing: number;
  skipped_no_teacher: number;
}

export type DraftResult = DraftCounts | { error: string };

/**
 * ⚠️ TEMPORARY TYPE HOLE — remove once types are regenerated.
 *
 * `types/database.types.ts` predates 20260728000007: it carries neither the
 * `generate_timesheet_drafts` function nor `attendance.schedule_instance_id`,
 * so the generated `rpc()` overloads reject both by name. Regenerating is
 * Derek's step in the Regular Terminal (CLAUDE.md §5):
 *
 *   supabase gen types typescript --project-id niabwaofqsirfsktyyff > types/database.types.ts
 *
 * The hole is confined to these two shapes rather than spread across call
 * sites, and both describe the real signatures — when the types land, deleting
 * these and the two casts below should compile with no other change.
 */
interface DraftRpcClient {
  rpc(
    fn: "generate_timesheet_drafts",
    args: {
      p_tenant_id: string;
      p_from: string;
      p_to: string;
      p_teacher_id?: string | null;
    }
  ): PromiseLike<{
    data: DraftCounts[] | null;
    error: { message: string } | null;
  }>;
}

/**
 * Generate drafts for a tenant over a date window, optionally for one teacher.
 *
 * NEVER THROWS. Every failure comes back as `{ error }` — a generator that
 * cannot run must not take the timesheet page down with it. A teacher with a
 * transient database error still needs to see, edit, and submit the hours they
 * already have; drafts are a convenience layered on top of that, not a
 * precondition for it.
 *
 * @param from `YYYY-MM-DD` inclusive — build it with the helpers in ./helpers,
 *             never with toISOString()
 */
export async function generateTimesheetDrafts(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    from: string;
    to: string;
    /** Omit or null to draft for every teacher in the tenant. */
    teacherId?: string | null;
  }
): Promise<DraftResult> {
  try {
    const { data, error } = await (supabase as unknown as DraftRpcClient).rpc(
      "generate_timesheet_drafts",
      {
        p_tenant_id: opts.tenantId,
        p_from: opts.from,
        p_to: opts.to,
        p_teacher_id: opts.teacherId ?? null,
      }
    );

    if (error) {
      console.error("[timesheets:generateDrafts]", error);
      return { error: error.message };
    }

    // RETURNS TABLE with a single row — PostgREST hands back an array of one.
    // A zero-length array is not an error: it means the function returned no
    // row at all, which nothing in its body does today, but reading [0] blind
    // would turn that into `undefined.created` at render time.
    const row = data?.[0];
    if (!row) return { error: "Generator returned no counts." };

    return row;
  } catch (err) {
    console.error("[timesheets:generateDrafts] threw", err);
    return { error: err instanceof Error ? err.message : "Draft generation failed." };
  }
}

/** Narrow shape of the attendance rows this module reads. */
interface AttendanceInstanceRow {
  schedule_instance_id: string | null;
}

interface AttendanceRpcClient {
  from(table: "attendance"): {
    select(cols: "schedule_instance_id"): {
      in(
        col: "schedule_instance_id",
        vals: string[]
      ): PromiseLike<{
        data: AttendanceInstanceRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Which of these schedule instances have attendance recorded against them.
 *
 * Joined ONLY on `attendance.schedule_instance_id`. Matching on
 * `(class_id, class_date)` instead — the shape the table had before
 * 20260728000007 — is wrong, not merely imprecise: two occurrences of the same
 * class on the same day are two distinct classes with two distinct rosters, and
 * a class/date match would report attendance taken for both when it was taken
 * for one. Rehearsal weeks produce exactly that.
 *
 * No legacy fallback, deliberately. `attendance` has 0 rows, so there is no
 * historical state to accommodate and no reason to carry an ambiguous path
 * forward. Rows written by a path that does not set the column will read as
 * "not recorded" — which is the honest answer for a row that cannot say which
 * occurrence it belongs to. See markAttendance in
 * app/(teach)/teach/attendance/actions.ts: it is the only writer and it does
 * not set the column yet.
 *
 * Returns an empty set on any failure. This drives a PROMPT, never a block —
 * confirming an entry must succeed whether or not attendance was taken.
 */
export async function fetchAttendanceTakenInstances(
  supabase: SupabaseClient,
  instanceIds: string[]
): Promise<Set<string>> {
  const ids = instanceIds.filter(Boolean);
  if (ids.length === 0) return new Set();

  try {
    const { data, error } = await (supabase as unknown as AttendanceRpcClient)
      .from("attendance")
      .select("schedule_instance_id")
      .in("schedule_instance_id", ids);

    if (error) {
      console.error("[timesheets:attendanceTaken]", error);
      return new Set();
    }

    return new Set(
      (data ?? [])
        .map((r) => r.schedule_instance_id)
        .filter((id): id is string => !!id)
    );
  } catch (err) {
    console.error("[timesheets:attendanceTaken] threw", err);
    return new Set();
  }
}
