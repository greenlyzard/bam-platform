import { createClient } from "@/lib/supabase/server";
import { getTenantTimezone } from "@/lib/tenant/timezone";
import { redirect } from "next/navigation";

export type UserRole = "super_admin" | "admin" | "studio_admin" | "finance_admin" | "studio_manager" | "front_desk" | "teacher" | "parent" | "student";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  firstName: string | null;
  lastName: string | null;
  /**
   * Tenant from the user's primary `profile_roles` row.
   *
   * Null when the user has no active role rows — a real state (new signups).
   * Roughly twenty call sites spend this as `user.tenantId!`; those assertions
   * were already unsound and remain so. Failing closed on a read error makes
   * them *less* exposed, not more: the error case now throws instead of
   * returning a user with a null tenant. No call site was changed to suit this.
   */
  tenantId: string | null;
  /**
   * The tenant's IANA timezone, from `tenants.timezone`.
   *
   * Never null — falls back to DEFAULT_TENANT_TIMEZONE when the user has no
   * resolvable tenant, so no caller has to branch. Pass this to the tenant*
   * helpers in lib/dates.ts for any server-side calendar date; the server
   * runtime is UTC and must never be used directly.
   */
  timezone: string;
}

const BAM_TENANT_SLUG = "bam";

/**
 * Get the authenticated user with their roles, from `profile_roles` only.
 *
 * Two outcomes, deliberately kept distinct — conflating them was the bug:
 *
 *  - The read FAILS  → throw. An auth resolver that cannot reach the
 *    authoritative source must not guess a role from a stale column.
 *  - The read SUCCEEDS with zero rows → `['parent']`. This is a real,
 *    expected state, not a failure (see the comment at the branch).
 *
 * `profiles.role` is never consulted. It is a stale single-role mirror typed
 * as the `user_role` enum, which cannot even represent finance_admin /
 * studio_admin / studio_manager — see CLAUDE.md §4.
 *
 * Mirrors lib/auth/getSessionWithRole.ts, which resolves roles the same way.
 * Callers must be inside an error boundary; `app/error.tsx` is the one that
 * catches a throw from a route-group layout.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Display fields only. `role` is deliberately not selected — nothing in this
  // resolver may authorize off it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  // No try/catch: postgrest-js rejects only when .throwOnError() is set (it is
  // not here), so every failure — including fetch/network errors, which it
  // catches internally and converts — arrives in `error`. A try/catch around
  // this is dead code that has never once executed. Do not re-add one.
  const { data: profileRoles, error: rolesError } = await supabase
    .from("profile_roles")
    .select("role, tenant_id, is_primary")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false });

  if (rolesError) {
    // This path was 100% silent before, which is why it was never observed.
    console.error("[auth:getUser] profile_roles read failed", {
      userId: user.id,
      code: rolesError.code,
      message: rolesError.message,
    });
    throw new Error(
      `Could not read profile_roles for ${user.id} (${rolesError.code || "no code"}): ${rolesError.message}`
    );
  }

  let roles: UserRole[];
  let primaryRole: UserRole;
  let tenantId: string | null = null;

  if (profileRoles.length > 0) {
    roles = profileRoles.map((pr) => pr.role as UserRole);
    const primary = profileRoles.find((pr) => pr.is_primary);
    primaryRole = (primary?.role ?? profileRoles[0].role) as UserRole;
    tenantId = primary?.tenant_id ?? profileRoles[0].tenant_id ?? null;
  } else {
    // Zero active roles is expected, not broken: handle_new_user() inserts a
    // profiles row and NO profile_roles row, so every new signup lands here
    // until an admin grants one. Five live profiles are in this state today.
    //
    // Resolve to the least privilege we have rather than reading profiles.role.
    // DELETE /api/admin/roles removes a profile_roles row without mirroring the
    // change to profiles.role (staff-actions.ts does mirror it; that route does
    // not — separate ticket). Reading the stale column here would hand a
    // revoked admin their access back. Defaulting instead closes that.
    //
    // NOTE: tenantId stays null on this branch, exactly as it did before. See
    // the tenantId note in the AuthUser docblock.
    primaryRole = "parent";
    roles = ["parent"];
  }

  const timezone = await getTenantTimezone(supabase, tenantId);

  return {
    id: user.id,
    email: user.email ?? "",
    role: primaryRole,
    roles,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    tenantId,
    timezone,
  };
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a specific role. Checks all active roles, not just primary.
 * Redirects to the user's home dashboard if they lack any of the required roles.
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<AuthUser> {
  const user = await requireAuth();

  // Check if any of the user's roles match any allowed role
  const hasRole = user.roles.some((r) => allowedRoles.includes(r));

  if (!hasRole) {
    const roleHome: Record<string, string> = {
      super_admin: "/admin/dashboard",
      admin: "/admin/dashboard",
      studio_admin: "/admin/dashboard",
      finance_admin: "/admin/dashboard",
      studio_manager: "/admin/dashboard",
      front_desk: "/admin/dashboard",
      teacher: "/teach/dashboard",
      parent: "/portal/dashboard",
      student: "/portal/dashboard",
    };
    redirect(roleHome[user.role] ?? "/portal/dashboard");
  }

  return user;
}

/**
 * Every role that confers admin-tier access.
 *
 * MUST STAY IN SYNC with the `is_admin()` SQL function in the database
 * (see the COMMENT on that function). Any role in this list can reach the
 * admin surface and satisfies `is_admin()` in RLS, so granting one is a
 * privilege escalation and must be reserved to super_admin.
 *
 * This list previously lived inline in addStaffRole/removeStaffRole and had
 * drifted — it omitted studio_admin and studio_manager, which meant anyone
 * could grant themselves admin-tier access through a role the escalation
 * check did not recognise. Keep it in one place.
 */
export const ADMIN_TIER_ROLES = [
  "admin",
  "super_admin",
  "studio_admin",
  "studio_manager",
  "finance_admin",
] as const;

/**
 * Require admin or super_admin role.
 */
export async function requireAdmin(): Promise<AuthUser> {
  return requireRole(...ADMIN_TIER_ROLES);
}

/**
 * Require finance-level access: finance_admin or super_admin only.
 *
 * Deliberately NARROWER than requireAdmin() — use this for anything that
 * reads or writes compensation (pay rates, rate cards, payroll figures).
 * A plain `admin` runs the studio but does not see or set what people are
 * paid. Mirrors canViewPayRates() in lib/rbac/permissions.ts and
 * has_finance_role() in the database.
 */
export async function requireFinance(): Promise<AuthUser> {
  return requireRole("finance_admin", "super_admin");
}

/**
 * Require teacher, admin, or super_admin role.
 */
export async function requireTeacher(): Promise<AuthUser> {
  return requireRole("teacher", "admin", "super_admin");
}

/**
 * Require parent role (or any role that can access portal).
 */
export async function requireParent(): Promise<AuthUser> {
  return requireRole("parent", "student", "teacher", "admin", "super_admin");
}

/**
 * Check if a user has a specific permission key.
 * Uses profile_roles + role_permissions + permissions tables.
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase.rpc("has_permission", {
    perm_key: permissionKey,
  });

  return !!data;
}
