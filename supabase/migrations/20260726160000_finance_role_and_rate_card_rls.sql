-- ============================================================
-- has_finance_role() + narrow compensation RLS
--
-- is_admin() resolves to five roles:
--   admin, super_admin, studio_admin, studio_manager, finance_admin
-- and gated every rate-bearing table, so a plain `admin` had full read/write
-- on all compensation data straight through PostgREST — no UI involved.
--
-- has_finance_role() is the DB-side twin of canViewPayRates()
-- (lib/rbac/permissions.ts) and requireFinance() (lib/auth/guards.ts):
-- finance_admin or super_admin only. SECURITY DEFINER + a profile_roles
-- query, matching the existing is_admin() pattern exactly so it is safe to
-- use inside policies without triggering RLS recursion.
--
-- SCOPE — deliberately limited to teacher_rate_cards. See the note at the
-- bottom for why `teachers` and `timesheet_entries` are NOT narrowed here.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_finance_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid()
      AND role IN ('finance_admin', 'super_admin')
      AND is_active = true
  )
$function$;

COMMENT ON FUNCTION public.has_finance_role() IS
  'True for finance_admin or super_admin only. Use for compensation data; is_admin() is deliberately wider and must not gate pay rates.';

-- ── teacher_rate_cards ──────────────────────────────────────
-- Every column on this table is compensation (market/standard rates by
-- duration, point cost, cancellation and no-show charge percentages), so the
-- whole table narrows cleanly with no split required.
--
-- The teacher-reads-own-card policy is left exactly as it was: a teacher
-- seeing their own agreed rates is intended.

DROP POLICY IF EXISTS "Admins can manage rate cards" ON public.teacher_rate_cards;

CREATE POLICY "Finance can manage rate cards"
  ON public.teacher_rate_cards
  FOR ALL
  USING (public.has_finance_role())
  WITH CHECK (public.has_finance_role());

-- ── NOT narrowed here, and why ──────────────────────────────
--
-- public.teachers
--   4 of 24 columns are rates (class/private/rehearsal/admin_rate_cents).
--   The other 20 — name linkage, employment_type, hire_date, compliance
--   flags, can_be_scheduled, substitute counters — are needed by plain
--   admins on /admin/staff and the staff profile. Narrowing the table
--   policy to has_finance_role() would break non-financial staff admin.
--
-- public.timesheet_entries
--   rate_amount / rate_override are 2 columns of ~42. Plain admins
--   legitimately approve, flag, and adjust entries.
--
-- RLS cannot express "these columns, not those" (see
-- 20260726150000 for the same constraint). Genuinely protecting these two
-- at the database layer requires moving the rate columns into their own
-- table with its own has_finance_role() policy — a schema split touching
-- payroll, the rate editor, and the timesheets CSV. That is deferred.
--
-- Until then those two tables are protected at the APPLICATION layer only,
-- via canViewPayRates() on every surface that renders or exports a rate.
-- A determined plain-admin with a valid session could still read
-- teachers.*_rate_cents and timesheet_entries.rate_amount directly through
-- PostgREST. This migration does not close that; it closes the
-- teacher_rate_cards case completely and names the remaining gap.
-- ============================================================

NOTIFY pgrst, 'reload schema';
