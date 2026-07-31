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
 * Callers must be inside an error boundary. `app/error.tsx` is the one that
 * catches a throw from a route-group layout.
 */
export async function getSessionWithRole(): Promise<SessionWithRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Display fields only. `role` is deliberately not selected — nothing in this
  // resolver may authorize off it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, preferred_name, avatar_url")
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
    console.error(
      "[auth:getSessionWithRole] profile_roles read failed",
      { userId: user.id, code: rolesError.code, message: rolesError.message }
    );
    throw new Error(
      `Could not read profile_roles for ${user.id} (${rolesError.code || "no code"}): ${rolesError.message}`
    );
  }

  let primaryRole: Role;
  let roles: Role[];
  let tenantId: string | null = null;

  if (profileRoles.length > 0) {
    roles = profileRoles.map((pr) => pr.role as Role);
    const primary = profileRoles.find((pr) => pr.is_primary);
    primaryRole = (primary?.role ?? profileRoles[0].role) as Role;
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
    primaryRole = "parent";
    roles = ["parent"];
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
