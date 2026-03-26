import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TeacherProfileAdmin } from "./teacher-profile-admin";

export default async function AdminTeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id: teacherId } = await params;
  const supabase = await createClient();

  // Fetch teacher profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, avatar_url, bio, title, bio_short, bio_full, years_experience, education, social_instagram, social_linkedin")
    .eq("id", teacherId)
    .single();

  if (!profile) notFound();

  // Verify teacher role
  const { data: role } = await supabase
    .from("profile_roles")
    .select("is_active")
    .eq("user_id", teacherId)
    .eq("role", "teacher")
    .single();

  if (!role) notFound();

  // Fetch disciplines, affiliations, photos, icon library
  let disciplines: any[] = [];
  let affiliations: any[] = [];
  let photos: any[] = [];
  let iconLibrary: any[] = [];
  try {
    const [disciplinesResult, affiliationsResult, photosResult, iconsResult] = await Promise.all([
      supabase.from("teacher_disciplines").select("*, icon_library(*)").eq("teacher_id", teacherId).order("sort_order"),
      supabase.from("teacher_affiliations").select("*, icon_library(*)").eq("teacher_id", teacherId).order("sort_order"),
      supabase.from("teacher_photos").select("*").eq("teacher_id", teacherId).eq("is_active", true).order("sort_order"),
      supabase.from("icon_library").select("*").eq("is_active", true).order("sort_order"),
    ]);
    disciplines = disciplinesResult.data ?? [];
    affiliations = affiliationsResult.data ?? [];
    photos = photosResult.data ?? [];
    iconLibrary = iconsResult.data ?? [];
  } catch {
    // Tables may not exist yet — gracefully default to empty arrays
  }

  // Parallel fetch all related data
  const [
    specialtiesResult,
    rateCardsResult,
    complianceResult,
    subEligResult,
    classTeachersResult,
    availabilityCount,
    privateCount,
  ] = await Promise.all([
    supabase
      .from("teacher_specialties")
      .select("id, specialty, sort_order")
      .eq("teacher_id", teacherId)
      .order("sort_order"),
    supabase
      .from("teacher_rate_cards")
      .select("*")
      .eq("teacher_id", teacherId),
    supabase
      .from("teacher_compliance")
      .select("*")
      .eq("teacher_id", teacherId)
      .single(),
    supabase
      .from("teacher_sub_eligibility")
      .select("*")
      .eq("teacher_id", teacherId)
      .single(),
    supabase
      .from("class_teachers")
      .select("class_id, classes(id, name, day_of_week, start_time, end_time, levels, max_enrollment, max_students)")
      .eq("teacher_id", teacherId),
    supabase
      .from("teacher_availability")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId),
    supabase
      .from("private_sessions")
      .select("id", { count: "exact", head: true })
      .eq("primary_teacher_id", teacherId)
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
    isActive: role.is_active,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/teachers/${teacherId}`}
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Teacher
        </Link>
      </div>

      <TeacherProfileAdmin
        teacher={teacher}
        specialties={specialtiesResult.data ?? []}
        rateCards={rateCardsResult.data ?? []}
        compliance={complianceResult.data ?? null}
        subEligibility={subEligResult.data ?? null}
        classes={classes}
        availabilityCount={availabilityCount.count ?? 0}
        privateCount={privateCount.count ?? 0}
        tenantId={user.tenantId!}
        disciplines={disciplines}
        affiliations={affiliations}
        photos={photos}
        iconLibrary={iconLibrary}
      />
    </div>
  );
}
