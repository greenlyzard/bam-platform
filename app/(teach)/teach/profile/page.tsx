import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { TeacherSelfProfile } from "./teacher-self-profile";

export default async function TeacherProfilePage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  // Fetch own profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, avatar_url, bio")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="text-center py-12 text-slate">
        Profile not found. Please contact an administrator.
      </div>
    );
  }

  // Get teacher role active status
  const { data: role } = await supabase
    .from("profile_roles")
    .select("is_active")
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .single();

  // Parallel fetch: specialties, compliance, sub_eligibility, class_teachers, private_sessions count
  const [
    specialtiesResult,
    complianceResult,
    subEligResult,
    classTeachersResult,
    privateCount,
  ] = await Promise.all([
    supabase
      .from("teacher_specialties")
      .select("id, specialty, sort_order")
      .eq("teacher_id", user.id)
      .order("sort_order"),
    supabase
      .from("teacher_compliance")
      .select("*")
      .eq("teacher_id", user.id)
      .single(),
    supabase
      .from("teacher_sub_eligibility")
      .select("*")
      .eq("teacher_id", user.id)
      .single(),
    supabase
      .from("class_teachers")
      .select("class_id, classes(id, name, day_of_week, start_time, end_time, levels, max_enrollment, max_students)")
      .eq("teacher_id", user.id),
    supabase
      .from("private_sessions")
      .select("id", { count: "exact", head: true })
      .eq("primary_teacher_id", user.id)
      .neq("status", "cancelled"),
  ]);

  // Fetch enrolled counts per class
  const classIds = (classTeachersResult.data ?? [])
    .map((ct: any) => ct.classes?.id)
    .filter(Boolean);

  const enrollmentCounts: Record<string, number> = {};
  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .in("class_id", classIds)
      .in("status", ["active", "trial"]);

    for (const e of enrollments ?? []) {
      enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] || 0) + 1;
    }
  }

  // Build class assignments
  const classes = (classTeachersResult.data ?? [])
    .filter((ct: any) => ct.classes)
    .map((ct: any) => {
      const c = Array.isArray(ct.classes) ? ct.classes[0] : ct.classes;
      return {
        classId: c.id,
        className: c.name,
        dayOfWeek: c.day_of_week,
        startTime: c.start_time,
        endTime: c.end_time,
        levels: c.levels,
        enrolled: enrollmentCounts[c.id] || 0,
        capacity: c.max_enrollment ?? c.max_students ?? 0,
      };
    });

  const teacher = {
    ...profile,
    isActive: role?.is_active ?? false,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-charcoal">
        My Profile
      </h1>

      <TeacherSelfProfile
        teacher={teacher}
        specialties={specialtiesResult.data ?? []}
        compliance={complianceResult.data ?? null}
        subEligibility={subEligResult.data ?? null}
        classes={classes}
        privateCount={privateCount.count ?? 0}
        tenantId={user.tenantId!}
      />
    </div>
  );
}
