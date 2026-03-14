import { createClient } from "@/lib/supabase/server";
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
}

const BAM_TENANT_SLUG = "bam";

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

  // Try profile_roles table first
  const { data: profileRoles } = await supabase
    .from("profile_roles")
    .select("role, tenant_id, is_primary")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false });

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

  return {
    id: user.id,
    email: user.email ?? "",
    role: primaryRole,
    roles,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    tenantId,
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
 * Require admin or super_admin role.
 */
export async function requireAdmin(): Promise<AuthUser> {
  return requireRole("admin", "super_admin", "studio_admin", "finance_admin", "studio_manager");
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
