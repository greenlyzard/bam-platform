-- ============================================================
-- Document the is_admin() <-> ADMIN_TIER_ROLES coupling
--
-- is_admin() gates most admin RLS policies. The same role list is mirrored
-- in TypeScript as ADMIN_TIER_ROLES (lib/auth/guards.ts), which backs both
-- requireAdmin() and the privilege-escalation check in addStaffRole /
-- removeStaffRole.
--
-- The two drifted once already: the escalation check hardcoded only
-- admin / finance_admin / super_admin, omitting studio_admin and
-- studio_manager. Because is_admin() DOES recognise those two, granting one
-- conferred full admin-tier access while bypassing the escalation gate.
--
-- This migration changes no behaviour — it attaches a comment so the coupling
-- is visible from the database side, where the next person is most likely to
-- edit the role list.
-- ============================================================

COMMENT ON FUNCTION public.is_admin() IS
  'True for any admin-tier role: admin, super_admin, studio_admin, studio_manager, finance_admin. MUST STAY IN SYNC with ADMIN_TIER_ROLES in lib/auth/guards.ts, which backs requireAdmin() and the role-granting escalation check. Adding a role here without adding it there lets that role be granted by a non-owner. Note this is deliberately WIDER than has_finance_role() — do not use is_admin() to gate compensation data.';

NOTIFY pgrst, 'reload schema';
