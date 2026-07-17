// DB layer for the schedule occurrence generator (task 19). Materializes `schedule_instances`
// from the live `classes` rows + `studio_closures`, over a rolling 120-day window.
//
// Discipline:
// - Uses the service-role client (createAdminClient) — this is server-only billing/schedule data.
// - Upserts on `ical_uid` (= `${class_id}:${event_date}`) so re-runs never duplicate and NEVER
//   blind-insert; the upsert only touches the columns we set, preserving approvals / substitute
//   assignments / notes on existing rows.
// - Only ever writes/deletes rows with `event_date >= today` (the window). PAST rows are never
//   touched — attendance may reference them.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateOccurrencesForClass,
  type ClassForOccurrences,
  type ClosureMap,
  type OccurrenceRow,
} from "./occurrences";

/** How far ahead to materialize occurrences (rolling window, clamped per class). */
const WINDOW_DAYS = 120;
/** BAM tenant slug — classes has no tenant_id, so occurrences resolve it once from `tenants`. */
const TENANT_SLUG = "bam";

const CLASS_COLS =
  "id, teacher_id, room_id, location_id, day_of_week, start_time, end_time, start_date, end_date";

type Admin = ReturnType<typeof createAdminClient>;

function windowBounds() {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);
  const windowEnd = end.toISOString().slice(0, 10);
  return { today, windowEnd };
}

async function resolveTenantId(admin: Admin): Promise<string | null> {
  const { data } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", TENANT_SLUG)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function loadClosures(admin: Admin, from: string, to: string): Promise<ClosureMap> {
  const { data } = await admin
    .from("studio_closures")
    .select("closed_date, reason")
    .gte("closed_date", from)
    .lte("closed_date", to);
  const map: ClosureMap = {};
  for (const c of data ?? []) {
    map[c.closed_date as string] = (c.reason as string | null) || "Studio closure";
  }
  return map;
}

function toOccInput(cls: Record<string, unknown>, tenantId: string): ClassForOccurrences {
  return {
    id: cls.id as string,
    tenant_id: tenantId,
    teacher_id: (cls.teacher_id as string | null) ?? null,
    room_id: (cls.room_id as string | null) ?? null,
    location_id: (cls.location_id as string | null) ?? null,
    day_of_week: (cls.day_of_week as number | null) ?? null,
    start_time: (cls.start_time as string | null) ?? null,
    end_time: (cls.end_time as string | null) ?? null,
    start_date: (cls.start_date as string | null) ?? null,
    end_date: (cls.end_date as string | null) ?? null,
  };
}

/**
 * Persist one class's occurrences: upsert the generated rows, then prune stale FUTURE rows (rows
 * whose `ical_uid` is no longer produced — e.g. the class's day changed). Past rows (event_date <
 * today) are never deleted or downgraded.
 */
async function persist(
  admin: Admin,
  classId: string,
  rows: OccurrenceRow[],
  today: string
): Promise<{ upserted: number; deleted: number }> {
  if (rows.length > 0) {
    const { error } = await admin
      .from("schedule_instances")
      .upsert(rows, { onConflict: "ical_uid" });
    if (error) {
      console.error("[schedule:generate] upsert failed", classId, error);
      throw error;
    }
  }

  // Prune: existing FUTURE rows for this class not in the freshly-generated keep-set.
  const { data: existingFuture, error: readErr } = await admin
    .from("schedule_instances")
    .select("id, ical_uid")
    .eq("class_id", classId)
    .gte("event_date", today);
  if (readErr) {
    console.error("[schedule:generate] future-read failed", classId, readErr);
    throw readErr;
  }
  const keep = new Set(rows.map((r) => r.ical_uid));
  const staleIds = (existingFuture ?? [])
    .filter((r) => !keep.has(r.ical_uid as string))
    .map((r) => r.id as string);

  let deleted = 0;
  if (staleIds.length > 0) {
    const { error: delErr } = await admin
      .from("schedule_instances")
      .delete()
      .in("id", staleIds);
    if (delErr) {
      console.error("[schedule:generate] stale-delete failed", classId, delErr);
      throw delErr;
    }
    deleted = staleIds.length;
  }
  return { upserted: rows.length, deleted };
}

/** Regenerate one class's occurrences over the rolling window. Used on-demand after class save. */
export async function regenerateClassOccurrences(
  classId: string
): Promise<{ upserted: number; deleted: number }> {
  const admin = createAdminClient();
  const { today, windowEnd } = windowBounds();

  const tenantId = await resolveTenantId(admin);
  if (!tenantId) {
    console.error("[schedule:generate] could not resolve tenant");
    return { upserted: 0, deleted: 0 };
  }

  const { data: cls } = await admin
    .from("classes")
    .select(CLASS_COLS)
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { upserted: 0, deleted: 0 };

  const closures = await loadClosures(admin, today, windowEnd);
  const rows = generateOccurrencesForClass(
    toOccInput(cls as Record<string, unknown>, tenantId),
    closures,
    today,
    windowEnd
  );
  return persist(admin, classId, rows, today);
}

/**
 * Extend/reconcile occurrences for every active teaching class (daily cron). Re-running the
 * generation also reconciles closures: upserting flips `status` both directions on FUTURE rows
 * (new closure → cancelled, removed closure → published), leaving past rows untouched.
 */
export async function extendAllActiveClasses(): Promise<{
  classes: number;
  upserted: number;
  deleted: number;
}> {
  const admin = createAdminClient();
  const { today, windowEnd } = windowBounds();

  const tenantId = await resolveTenantId(admin);
  if (!tenantId) {
    console.error("[schedule:generate] could not resolve tenant");
    return { classes: 0, upserted: 0, deleted: 0 };
  }

  const { data: classes } = await admin
    .from("classes")
    .select(CLASS_COLS)
    .eq("is_active", true)
    .eq("is_rehearsal", false)
    .eq("is_performance", false);

  const closures = await loadClosures(admin, today, windowEnd);

  let upserted = 0;
  let deleted = 0;
  for (const cls of classes ?? []) {
    const rows = generateOccurrencesForClass(
      toOccInput(cls as Record<string, unknown>, tenantId),
      closures,
      today,
      windowEnd
    );
    const res = await persist(admin, (cls as Record<string, unknown>).id as string, rows, today);
    upserted += res.upserted;
    deleted += res.deleted;
  }
  return { classes: classes?.length ?? 0, upserted, deleted };
}
