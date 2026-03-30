import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClassManagement } from "./class-management";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ editClass?: string }>;
}) {
  const { editClass } = await searchParams;
  const user = await requireAdmin();
  const supabase = createAdminClient();

  // Fetch classes (no tenant_id on classes table)
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .order("day_of_week")
    .order("start_time");

  // Fetch enrollment counts
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .in("status", ["active", "trial"]);

  const enrollmentCounts: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] ?? 0) + 1;
  }

  // Fetch class_teachers — no tenant filter, admin client bypasses RLS
  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("*");

  // Fetch teacher profiles (VIEW — no tenant_id)
  const { data: teachers, error: teacherError } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name, email, is_active")
    .eq("is_active", true);
  console.log("TEACHER QUERY result:", teachers?.length, "error:", teacherError?.message);

  // Also get legacy teacher_id names from profiles
  const legacyTeacherIds = [
    ...new Set(
      (classes ?? []).map((c) => c.teacher_id).filter(Boolean) as string[]
    ),
  ];
  const legacyTeacherNames: Record<string, string> = {};
  if (legacyTeacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", legacyTeacherIds);
    for (const p of profiles ?? []) {
      legacyTeacherNames[p.id] = [p.first_name, p.last_name]
        .filter(Boolean)
        .join(" ");
    }
  }

  // Fetch disciplines (tenant-scoped)
  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .eq("is_active", true)
    .order("sort_order");

  // Fetch curriculum (tenant-scoped)
  const { data: curriculum } = await supabase
    .from("dance_curriculum")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .eq("is_active", true)
    .order("sort_order");

  // Fetch seasons (tenant-scoped)
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("tenant_id", user.tenantId!)
    .order("created_at", { ascending: false });

  // Fetch productions
  const { data: productions } = await supabase
    .from("productions")
    .select("id, name")
    .order("created_at", { ascending: false });

  // Fetch studio closures (tenant-scoped)
  const { data: closures } = await supabase
    .from("studio_closures")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("closed_date");

  // Fetch pricing rules
  const { data: pricingRules } = await supabase
    .from("class_pricing_rules")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("sort_order");

  // Column list is driven by class_field_config table. To add a new field, insert a row — no code changes needed.
  const { data: fieldConfigRows } = await supabase
    .from("class_field_config")
    .select("field_key, label, field_type, admin_visible, admin_default_on, is_core, sort_order, group_name")
    .eq("tenant_id", user.tenantId!)
    .eq("admin_visible", true)
    .order("sort_order");

  // Fetch class phases
  const { data: classPhases } = await supabase
    .from("class_phases")
    .select("*")
    .eq("tenant_id", user.tenantId!)
    .order("start_date");

  // Fetch rooms and locations for name resolution
  const { data: roomRows } = await supabase.from("rooms").select("id, name, color_hex, is_active").eq("is_active", true);
  const roomMap: Record<string, string> = {};
  for (const r of roomRows ?? []) roomMap[r.id] = r.name;

  const { data: locationRows } = await supabase.from("studio_locations").select("id, name");
  const locationMap: Record<string, string> = {};
  for (const l of locationRows ?? []) locationMap[l.id] = l.name;

  // Fetch private sessions and studio closures for calendar view
  const { data: privateSessionsRaw } = await supabase
    .from("private_sessions")
    .select("id, session_date, start_time, end_time, status, studio, primary_teacher_id, student_ids, session_notes")
    .neq("status", "cancelled");

  const { data: studioClosureRows } = await supabase
    .from("studio_closures")
    .select("id, closed_date, reason")
    .eq("tenant_id", user.tenantId!);

  // Fetch class color palette from studio settings
  const { data: studioSettingsData } = await supabase
    .from("studio_settings")
    .select("custom_colors")
    .single();

  const classColorPalette: string[] =
    (studioSettingsData?.custom_colors as any)?.class_palette ?? [
      "#9C8BBF","#F9D5E5","#E8D5F9","#D5E8F9","#D5F9E8",
      "#F9F0D5","#F9E8D5","#EDE9F4","#F5E6FF","#E6F0FF",
    ];

  return (
    <ClassManagement
      classes={(classes ?? []).map((c) => ({
        ...c,
        enrolledCount: enrollmentCounts[c.id] ?? 0,
        legacyTeacherName: c.teacher_id
          ? legacyTeacherNames[c.teacher_id] ?? null
          : null,
      }))}
      classTeachers={classTeachers ?? []}
      teachers={(teachers ?? []).map((t) => ({
        id: t.id,
        name: [t.first_name, t.last_name].filter(Boolean).join(" "),
        email: t.email,
      }))}
      disciplines={disciplines ?? []}
      curriculum={curriculum ?? []}
      seasons={seasons ?? []}
      productions={productions ?? []}
      closures={closures ?? []}
      pricingRules={pricingRules ?? []}
      classPhases={classPhases ?? []}
      fieldConfig={fieldConfigRows ?? []}
      roomMap={roomMap}
      locationMap={locationMap}
      activeRooms={(roomRows ?? []).map(r => ({ id: r.id, name: r.name, color_hex: (r as any).color_hex ?? null }))}
      privateSessionsRaw={(privateSessionsRaw ?? []).map((p: any) => ({ id: p.id, session_date: p.session_date, start_time: p.start_time, end_time: p.end_time, status: p.status, studio: p.studio, primary_teacher_id: p.primary_teacher_id, student_ids: p.student_ids ?? [], notes: p.session_notes }))}
      studioClosures={(studioClosureRows ?? []).map((c: any) => ({ id: c.id, closed_date: c.closed_date, reason: c.reason }))}
      classColorPalette={classColorPalette}
      initialEditClassId={editClass ?? null}
      tenantId={user.tenantId!}
    />
  );
}
