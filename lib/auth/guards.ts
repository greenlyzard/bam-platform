import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "super_admin" | "admin" | "studio_admin" | "finance_admin" | "studio_manager" | "front_desk" | "teacher" | "parent" | "student";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Get the authenticated user with their profile.
 * Returns null if not authenticated (does not redirect).
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

  return {
    id: user.id,
    email: user.email ?? "",
    role: (profile?.role as UserRole) ?? "parent",
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
  };
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Use in server components and server actions.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a specific role (or higher).
 * Redirects to the user's home dashboard if they lack the required role.
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<AuthUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
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
