import { createClient } from "@/lib/supabase/server";

export type Role = "super_admin" | "admin" | "studio_admin" | "finance_admin" | "studio_manager" | "front_desk" | "teacher" | "parent" | "student";

export interface SessionWithRole {
  user: {
    id: string;
    email: string;
  };
  profile: {
    role: Role;
    full_name: string | null;
  };
}

/**
 * Get the authenticated user with their profile role.
 * Returns null if not authenticated.
 */
export async function getSessionWithRole(): Promise<SessionWithRole | null> {
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
    user: {
      id: user.id,
      email: user.email ?? "",
    },
    profile: {
      role: (profile?.role as Role) ?? "parent",
      full_name:
        profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : profile?.first_name ?? null,
    },
  };
}
