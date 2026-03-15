import { createClient } from "@/lib/supabase/server";

export type Role = "super_admin" | "admin" | "studio_admin" | "finance_admin" | "studio_manager" | "front_desk" | "teacher" | "parent" | "student";

export interface SessionWithRole {
  user: {
    id: string;
    email: string;
  };
  profile: {
    role: Role;
    roles: Role[];
    full_name: string | null;
    avatar_url: string | null;
    tenant_id: string | null;
  };
}

/**
 * Get the authenticated user with their profile role.
 * Checks profile_roles first, falls back to profiles.role.
 */
export async function getSessionWithRole(): Promise<SessionWithRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, preferred_name, avatar_url")
    .eq("id", user.id)
    .single();

  // Try profile_roles (gracefully handle table not existing or RLS errors)
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

  let primaryRole: Role;
  let roles: Role[];
  let tenantId: string | null = null;

  if (profileRoles && profileRoles.length > 0) {
    roles = profileRoles.map((pr) => pr.role as Role);
    const primary = profileRoles.find((pr) => pr.is_primary);
    primaryRole = (primary?.role ?? profileRoles[0].role) as Role;
    tenantId = primary?.tenant_id ?? profileRoles[0].tenant_id ?? null;
  } else {
    primaryRole = (profile?.role as Role) ?? "parent";
    roles = [primaryRole];
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
    },
    profile: {
      role: primaryRole,
      roles,
      full_name:
        (profile?.preferred_name ?? profile?.first_name)
          ? `${profile?.preferred_name ?? profile?.first_name} ${profile?.last_name ?? ''}`.trim()
          : null,
      avatar_url: profile?.avatar_url ?? null,
      tenant_id: tenantId,
    },
  };
}
