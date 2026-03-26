import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TeacherProfileAdmin } from "./teacher-profile-admin";

export default async function AdminStaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id: teacherId } = await params;

  console.log("[StaffProfilePage] called with id:", teacherId);

  const supabase = await createClient();

  // Fetch teacher profile — use maybeSingle to avoid PostgREST 406 on 0 rows
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, avatar_url, bio, title, bio_short, bio_full, years_experience, education, social_instagram, social_linkedin")
    .eq("id", teacherId)
    .maybeSingle();

  console.log("[StaffProfilePage] profile:", profile?.id, "error:", profileErr?.message);

  if (profileErr || !profile) {
    return (
      <div className="p-8 space-y-4">
        <Link href="/admin/staff" className="text-xs text-lavender hover:text-lavender-dark">&larr; Back to Staff</Link>
        <h1 className="text-xl font-heading font-bold text-charcoal">Profile Not Found</h1>
        <p className="text-sm text-slate">
          Could not load profile for ID: <code className="text-xs bg-cloud px-1 py-0.5 rounded">{teacherId}</code>
        </p>
        {profileErr && <p className="text-xs text-error">Error: {profileErr.message}</p>}
      </div>
    );
  }

  // Check for teacher or admin role — don't 404, just note what roles exist
  const { data: roles } = await supabase
    .from("profile_roles")
    .select("role, is_active")
    .eq("user_id", teacherId)
    .in("role", ["teacher", "admin", "super_admin"]);

  const isActive = roles?.some((r) => r.is_active) ?? true;

  console.log("[StaffProfilePage] roles:", roles?.map((r) => r.role).join(", ") || "none");

  // Safe fetch helpers — never throw
  async function safeFetchArray(query: PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
    try { const r = await query; return r.data ?? []; } catch { return []; }
  }
  async function safeFetchSingle(query: PromiseLike<{ data: any | null; error: any }>): Promise<any | null> {
    try { const r = await query; return r.data ?? null; } catch { return null; }
  }

  const [
    disciplines, affiliations, photos, iconLibrary,
    specialties, rateCards, compliance, subEligibility,
    classTeachersRaw, availabilityResult, privateResult,
  ] = await Promise.all([
    safeFetchArray(supabase.from("teacher_disciplines").select("*, icon_library(*)").eq("teacher_id", teacherId).order("sort_order")),
    safeFetchArray(supabase.from("teacher_affiliations").select("*, icon_library(*)").eq("teacher_id", teacherId).order("sort_order")),
    safeFetchArray(supabase.from("teacher_photos").select("*").eq("teacher_id", teacherId).eq("is_active", true).order("sort_order")),
    safeFetchArray(supabase.from("icon_library").select("*").eq("is_active", true).order("sort_order")),
    safeFetchArray(supabase.from("teacher_specialties").select("id, specialty, sort_order").eq("teacher_id", teacherId).order("sort_order")),
    safeFetchArray(supabase.from("teacher_rate_cards").select("*").eq("teacher_id", teacherId)),
    safeFetchSingle(supabase.from("teacher_compliance").select("*").eq("teacher_id", teacherId).maybeSingle()),
    safeFetchSingle(supabase.from("teacher_sub_eligibility").select("*").eq("teacher_id", teacherId).maybeSingle()),
    safeFetchArray(supabase.from("class_teachers").select("class_id, classes(id, name, day_of_week, start_time, end_time, levels, max_enrollment, max_students)").eq("teacher_id", teacherId)),
    safeFetchSingle(supabase.from("teacher_availability").select("id", { count: "exact", head: true }).eq("teacher_id", teacherId)),
    safeFetchSingle(supabase.from("private_sessions").select("id", { count: "exact", head: true }).eq("primary_teacher_id", teacherId).neq("status", "cancelled")),
  ]);

  // Enrollment counts
  const classIds = (classTeachersRaw ?? [])
    .map((ct: any) => { const c = Array.isArray(ct.classes) ? ct.classes[0] : ct.classes; return c?.id; })
    .filter(Boolean);

  const enrollmentCounts: Record<string, number> = {};
  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments").select("class_id").in("class_id", classIds).in("status", ["active", "trial"]);
    for (const e of enrollments ?? []) enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] || 0) + 1;
  }

  const classes = (classTeachersRaw ?? [])
    .filter((ct: any) => ct.classes)
    .map((ct: any) => {
      const c = Array.isArray(ct.classes) ? ct.classes[0] : ct.classes;
      if (!c) return null;
      return {
        classId: c.id, className: c.name, dayOfWeek: c.day_of_week,
        startTime: c.start_time, endTime: c.end_time, levels: c.levels,
        enrolled: enrollmentCounts[c.id] || 0, capacity: c.max_enrollment ?? c.max_students ?? 0,
      };
    })
    .filter((x: any): x is NonNullable<typeof x> => x != null);

  const teacher = { ...profile, isActive };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/staff" className="text-xs text-lavender hover:text-lavender-dark transition-colors">
          &larr; Back to Staff
        </Link>
      </div>
      <TeacherProfileAdmin
        teacher={teacher} specialties={specialties} rateCards={rateCards}
        compliance={compliance} subEligibility={subEligibility} classes={classes}
        availabilityCount={availabilityResult?.count ?? 0} privateCount={privateResult?.count ?? 0}
        tenantId={user.tenantId!} disciplines={disciplines} affiliations={affiliations}
        photos={photos} iconLibrary={iconLibrary}
      />
    </div>
  );
}
