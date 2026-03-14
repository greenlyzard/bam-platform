import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { RolesManager } from "./roles-manager";

export const metadata = {
  title: "Roles & Permissions — Settings",
};

export default async function RolesPage() {
  const user = await requireRole("super_admin", "admin", "studio_admin");
  const supabase = await createClient();

  // Fetch all profile_roles with user info
  const { data: profileRoles } = await supabase
    .from("profile_roles")
    .select("id, user_id, tenant_id, role, is_primary, is_active, assigned_at")
    .eq("is_active", true)
    .order("role")
    .order("assigned_at", { ascending: false });

  const userIds = [...new Set((profileRoles ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds)
    : { data: [] };

  const profileMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p;
  }

  const roleAssignments = (profileRoles ?? []).map((r) => {
    const p = profileMap[r.user_id];
    return {
      id: r.id,
      userId: r.user_id,
      role: r.role,
      isPrimary: r.is_primary,
      assignedAt: r.assigned_at,
      userName: p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown" : "Unknown",
      userEmail: p?.email ?? "",
    };
  });

  // Fetch all permissions with their role mappings
  const { data: permissions } = await supabase
    .from("permissions")
    .select("id, key, label, description, category")
    .order("category")
    .order("label");

  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("role, permission_id");

  const permRoleMap: Record<string, string[]> = {};
  for (const rp of rolePerms ?? []) {
    if (!permRoleMap[rp.permission_id]) permRoleMap[rp.permission_id] = [];
    permRoleMap[rp.permission_id].push(rp.role);
  }

  const permissionsWithRoles = (permissions ?? []).map((p) => ({
    ...p,
    roles: permRoleMap[p.id] ?? [],
  }));

  // Group permissions by category
  const categories: Record<string, typeof permissionsWithRoles> = {};
  for (const p of permissionsWithRoles) {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  }

  // Get all users for the assign dropdown
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .order("first_name");

  const allUsers = (allProfiles ?? []).map((p) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown",
    email: p.email ?? "",
  }));

  const isSuperAdmin = user.role === "super_admin";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <a
          href="/admin/settings"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Settings
        </a>
        <h1 className="mt-2 font-heading text-2xl font-bold text-charcoal">
          Roles &amp; Permissions
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage user roles and view the permission matrix.
        </p>
      </div>

      <RolesManager
        roleAssignments={roleAssignments}
        permissionCategories={categories}
        allUsers={allUsers}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
