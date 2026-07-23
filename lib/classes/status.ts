// Pure, display-only derivation of a class's status from its is_active flag + date window.
// No DB, no mutations — callers pass the class fields; nothing here writes is_active or dates.

export type ClassStatus = "scheduled" | "active" | "ended" | "inactive";

export interface DerivableClass {
  is_active: boolean | null;
  /** 'YYYY-MM-DD' */
  start_date: string | null;
  /** 'YYYY-MM-DD' */
  end_date: string | null;
}

/**
 * Derive a class's display status:
 * - `inactive`  — is_active === false (admin-disabled), regardless of dates
 * - `scheduled` — starts in the future (start_date > today)
 * - `ended`     — term is over (end_date < today)
 * - `active`    — otherwise (running now, or open-ended)
 *
 * `today` defaults to the local calendar date; pass it for testability.
 */
export function deriveClassStatus(cls: DerivableClass, today?: string): ClassStatus {
  const t = today ?? new Date().toISOString().slice(0, 10);
  if (cls.is_active === false) return "inactive";
  if (cls.start_date && cls.start_date > t) return "scheduled";
  if (cls.end_date && cls.end_date < t) return "ended";
  return "active";
}

/**
 * Enrollment date-eligibility — the single source of the catalog's date rule.
 *
 * Mirrors the `getClassCatalog()` filter (`end_date.is.null,end_date.gte.today`):
 * - open-ended (`end_date` null) → open
 * - `end_date` today or later → open
 * - `end_date` in the past → closed (the class has ended)
 *
 * Deliberately scoped to the date window ONLY. It does NOT check `is_active`,
 * `is_hidden`, capacity, or age — callers gate those separately. Season labels do
 * not bound dates by design (a class may legitimately run past its season's end),
 * so `season` is intentionally not consulted here.
 *
 * `today` defaults to the local calendar date; pass it for testability.
 */
export function isClassOpenForEnrollment(
  cls: { end_date: string | null },
  today?: string
): boolean {
  const t = today ?? new Date().toISOString().slice(0, 10);
  if (!cls.end_date) return true;
  return cls.end_date >= t;
}

export const CLASS_STATUS_LABEL: Record<ClassStatus, string> = {
  scheduled: "Scheduled",
  active: "Active",
  ended: "Ended",
  inactive: "Inactive",
};

/** Tailwind badge classes per status — consistent with the existing class-list pills. */
export const CLASS_STATUS_BADGE: Record<ClassStatus, string> = {
  scheduled: "bg-lavender/10 text-lavender-dark",
  active: "bg-success/10 text-success",
  ended: "bg-cloud text-slate",
  inactive: "bg-error/10 text-error",
};
