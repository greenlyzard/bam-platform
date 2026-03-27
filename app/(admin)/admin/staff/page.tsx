import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { StaffList } from "./StaffList";

export default async function StaffPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Fetch all profiles with teacher or admin roles
  const { data: roleRows } = await supabase
    .from("profile_roles")
    .select("user_id, role, is_active")
    .in("role", ["teacher", "admin", "super_admin"])
    .order("role");

  const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">Staff</h1>
        <p className="text-sm text-slate">No staff members found.</p>
      </div>
    );
  }

  // Fetch profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, avatar_url, title, bio_short, sort_order")
    .in("id", userIds);

  // Fetch teacher_disciplines + icon_library
  let disciplinesByTeacher: Record<string, Array<{ name: string; iconUrl: string | null }>> = {};
  try {
    const { data: discRows } = await supabase
      .from("teacher_disciplines")
      .select("teacher_id, name, icon_library(icon_url)")
      .in("teacher_id", userIds)
      .order("sort_order");
    for (const d of discRows ?? []) {
      if (!disciplinesByTeacher[d.teacher_id]) disciplinesByTeacher[d.teacher_id] = [];
      const icon = Array.isArray(d.icon_library) ? d.icon_library[0] : d.icon_library;
      disciplinesByTeacher[d.teacher_id].push({ name: d.name, iconUrl: (icon as any)?.icon_url ?? null });
    }
  } catch {}

  // Fetch class counts per teacher
  const { data: classTeacherRows } = await supabase
    .from("class_teachers")
    .select("teacher_id")
    .in("teacher_id", userIds);
  const classCounts: Record<string, number> = {};
  for (const ct of classTeacherRows ?? []) {
    classCounts[ct.teacher_id] = (classCounts[ct.teacher_id] || 0) + 1;
  }

  // Fetch compliance
  let complianceMap: Record<string, { mandated: boolean; background: boolean; w9: boolean }> = {};
  try {
    const { data: compRows } = await supabase
      .from("teacher_compliance")
      .select("teacher_id, mandated_reporter_status, background_check_status, w9_status")
      .in("teacher_id", userIds);
    for (const c of compRows ?? []) {
      complianceMap[c.teacher_id] = {
        mandated: ["cleared", "certified", "on_file"].includes(c.mandated_reporter_status ?? ""),
        background: ["cleared", "certified", "on_file"].includes(c.background_check_status ?? ""),
        w9: ["on_file", "cleared"].includes(c.w9_status ?? ""),
      };
    }
  } catch {}

  // Build role map
  const roleMap: Record<string, string[]> = {};
  const activeMap: Record<string, boolean> = {};
  for (const r of roleRows ?? []) {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
    roleMap[r.user_id].push(r.role);
    if (r.is_active) activeMap[r.user_id] = true;
  }

  // All unique disciplines for filter
  const allDisciplines = [...new Set(Object.values(disciplinesByTeacher).flat().map((d) => d.name))].sort();

  // Build staff array
  const staff = (profiles ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    avatarUrl: p.avatar_url,
    title: p.title,
    bioShort: p.bio_short,
    roles: roleMap[p.id] ?? [],
    isActive: activeMap[p.id] ?? false,
    classCount: classCounts[p.id] ?? 0,
    disciplines: disciplinesByTeacher[p.id] ?? [],
    compliance: complianceMap[p.id] ?? { mandated: false, background: false, w9: false },
    sortOrder: (p as any).sort_order as number | null,
  }));

  // Sort: if any have sort_order, use it; otherwise alphabetical
  const hasCustomOrder = staff.some((s) => s.sortOrder != null);
  if (hasCustomOrder) {
    staff.sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
      if (a.sortOrder != null) return -1;
      if (b.sortOrder != null) return 1;
      return (a.lastName ?? "").localeCompare(b.lastName ?? "");
    });
  } else {
    staff.sort((a, b) => {
      const ln = (a.lastName ?? "").localeCompare(b.lastName ?? "");
      if (ln !== 0) return ln;
      return (a.firstName ?? "").localeCompare(b.firstName ?? "");
    });
  }

  const isSuperAdmin = user.roles?.includes("super_admin") ?? false;

  return (
    <div className="space-y-6">
      <StaffList staff={staff} allDisciplines={allDisciplines} tenantId={user.tenantId!} isSuperAdmin={isSuperAdmin} hasCustomOrder={hasCustomOrder} />
    </div>
  );
}
