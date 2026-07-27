import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TENANT_TIMEZONE } from "@/lib/dates";
import { redirect } from "next/navigation";

export type UserRole = "super_admin" | "admin" | "studio_admin" | "finance_admin" | "studio_manager" | "front_desk" | "teacher" | "parent" | "student";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  firstName: string | null;
  lastName: string | null;
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
 * Process-local cache of tenant id → IANA timezone.
 *
 * `tenants` is not reachable from `profile_roles` via a PostgREST embed —
 * `profile_roles.tenant_id` has no FK to `tenants` (verified against
 * pg_constraint) — so resolving the zone is a genuine second round trip on top
 * of the profiles + profile_roles queries getUser() already makes. getUser()
 * runs more than once per request (layout guard, then page guard), so left
 * uncached this would add several Supabase round trips to every guarded page.
 *
 * A tenant's timezone changes approximately never, so a short TTL makes the
 * steady-state cost nil while still picking up an onboarding change within
 * five minutes. Only successful lookups are cached — a failure (e.g. the
 * migration not yet pushed) is retried on the next call so the fallback never
 * sticks.
 */
const TENANT_TZ_TTL_MS = 5 * 60 * 1000;
const tenantTimezoneCache = new Map<
  string,
  { timezone: string; expiresAt: number }
>();

async function resolveTenantTimezone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string | null
): Promise<string> {
  if (!tenantId) return DEFAULT_TENANT_TIMEZONE;

  const cached = tenantTimezoneCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.timezone;

  const { data, error } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .single();

  const timezone = (data as { timezone?: string | null } | null)?.timezone;
  if (error || !timezone) return DEFAULT_TENANT_TIMEZONE;

  tenantTimezoneCache.set(tenantId, {
    timezone,
    expiresAt: Date.now() + TENANT_TZ_TTL_MS,
  });
  return timezone;
}

/**
 * Get the authenticated user with their roles.
 * Checks profile_roles first, falls back to profiles.role.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();

  // Try profile_roles table first (gracefully handle table not existing or RLS errors)
  let profileRoles: Array<{ role: string; tenant_id: string | null; is_primary: boolean }> | null = null;
  try {
    const { data, error } = await supabase
      .from("profile_roles")
      .select("role, tenant_id, is_primary")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false });
    if (!error) profileRoles = data;
  } catch {
    // profile_roles table may not exist yet — fall back to profiles.role
  }

  let roles: UserRole[];
  let primaryRole: UserRole;
  let tenantId: string | null = null;

  if (profileRoles && profileRoles.length > 0) {
    roles = profileRoles.map((pr) => pr.role as UserRole);
    const primary = profileRoles.find((pr) => pr.is_primary);
    primaryRole = (primary?.role ?? profileRoles[0].role) as UserRole;
    tenantId = primary?.tenant_id ?? profileRoles[0].tenant_id ?? null;
  } else {
    // Fallback to profiles.role
    primaryRole = (profile?.role as UserRole) ?? "parent";
    roles = [primaryRole];
  }

  const timezone = await resolveTenantTimezone(supabase, tenantId);

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
