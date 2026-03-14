import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/guards";
import { z } from "zod";

const ADMIN_ROLES = ["super_admin", "admin", "studio_admin"];

async function requireRoleAdmin() {
  const user = await getUser();
  if (!user || !ADMIN_ROLES.some((r) => user.roles.includes(r as typeof user.role))) {
    return null;
  }
  return user;
}

/**
 * GET — list all profile_roles with user info
 */
export async function GET() {
  const admin = await requireRoleAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: roles } = await supabase
    .from("profile_roles")
    .select("id, user_id, tenant_id, role, is_primary, is_active, assigned_at")
    .order("assigned_at", { ascending: false });

  // Get user details for each unique user_id
  const userIds = [...new Set((roles ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p;
  }

  const result = (roles ?? []).map((r) => {
    const p = profileMap[r.user_id];
    return {
      id: r.id,
      userId: r.user_id,
      tenantId: r.tenant_id,
      role: r.role,
      isPrimary: r.is_primary,
      isActive: r.is_active,
      assignedAt: r.assigned_at,
      userName: p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email : "Unknown",
      userEmail: p?.email ?? "",
    };
  });

  return NextResponse.json({ roles: result });
}

/**
 * POST — assign a role to a user
 */
const assignSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export async function POST(req: Request) {
  const admin = await requireRoleAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { userId, role, isPrimary } = parsed.data;

  // Prevent non-super_admin from assigning super_admin
  if (role === "super_admin" && admin.role !== "super_admin") {
    return NextResponse.json({ error: "Only super_admin can assign super_admin role" }, { status: 403 });
  }

  const supabase = await createClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 500 });
  }

  // If setting as primary, unset other primary roles for this user
  if (isPrimary) {
    await supabase
      .from("profile_roles")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("tenant_id", tenant.id);
  }

  const { error } = await supabase.from("profile_roles").upsert(
    {
      user_id: userId,
      tenant_id: tenant.id,
      role,
      is_primary: isPrimary ?? false,
      is_active: true,
      assigned_by: admin.id,
    },
    { onConflict: "user_id,tenant_id,role" }
  );

  if (error) {
    console.error("[roles:assign]", error);
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }

  // Keep profiles.role in sync with primary role
  if (isPrimary) {
    await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE — remove a role assignment
 */
export async function DELETE(req: Request) {
  const admin = await requireRoleAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const roleId = searchParams.get("id");
  if (!roleId) {
    return NextResponse.json({ error: "Role ID required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Don't allow removing your own super_admin role
  const { data: roleRow } = await supabase
    .from("profile_roles")
    .select("user_id, role")
    .eq("id", roleId)
    .single();

  if (roleRow?.user_id === admin.id && roleRow?.role === "super_admin") {
    return NextResponse.json({ error: "Cannot remove your own super_admin role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profile_roles")
    .delete()
    .eq("id", roleId);

  if (error) {
    console.error("[roles:delete]", error);
    return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
