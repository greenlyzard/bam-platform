import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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

  try {
    const supabase = await createClient();

    // Fetch teacher profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, avatar_url, bio, title, bio_short, bio_full, years_experience, education, social_instagram, social_linkedin")
      .eq("id", teacherId)
      .single();

    if (profileErr || !profile) {
      console.error("[StaffProfilePage] Profile fetch failed:", profileErr?.message);
      notFound();
    }

    // Verify teacher role
    const { data: role } = await supabase
      .from("profile_roles")
      .select("is_active")
      .eq("user_id", teacherId)
      .eq("role", "teacher")
      .maybeSingle();

    if (!role) {
      // Try admin role as fallback (staff page shows both)
      const { data: adminRole } = await supabase
        .from("profile_roles")
        .select("is_active")
        .eq("user_id", teacherId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        console.error("[StaffProfilePage] No teacher or admin role found for:", teacherId);
        notFound();
      }
    }

    const isActive = role?.is_active ?? true;

    // Safe fetch helpers
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
  } catch (err) {
    console.error("[StaffProfilePage] fatal error:", err);
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-error">Profile Error</h1>
        <p className="text-sm text-slate mt-2">Something went wrong loading this profile. The error has been logged.</p>
        <pre className="text-xs mt-4 bg-cloud p-4 rounded-lg overflow-auto text-charcoal">{String(err)}</pre>
        <Link href="/admin/staff" className="mt-4 inline-block text-sm text-lavender hover:underline">
          &larr; Back to Staff
        </Link>
      </div>
    );
  }
}
