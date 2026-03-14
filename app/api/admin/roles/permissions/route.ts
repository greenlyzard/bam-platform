import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/guards";

/**
 * GET — list all permissions grouped by category, with which roles have each
 */
export async function GET() {
  const user = await getUser();
  if (!user || !["super_admin", "admin", "studio_admin"].some((r) => user.roles.includes(r as typeof user.role))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: permissions } = await supabase
    .from("permissions")
    .select("id, key, label, description, category")
    .order("category")
    .order("label");

  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("role, permission_id");

  // Build a map: permission_id → roles[]
  const permRoleMap: Record<string, string[]> = {};
  for (const rp of rolePerms ?? []) {
    if (!permRoleMap[rp.permission_id]) permRoleMap[rp.permission_id] = [];
    permRoleMap[rp.permission_id].push(rp.role);
  }

  const result = (permissions ?? []).map((p) => ({
    ...p,
    roles: permRoleMap[p.id] ?? [],
  }));

  return NextResponse.json({ permissions: result });
}
