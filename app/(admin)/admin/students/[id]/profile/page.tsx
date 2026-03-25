import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminStudentProfile } from "./admin-student-profile";

export default async function AdminStudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id: studentId } = await params;
  const supabase = await createClient();

  // Fetch student
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  // Parallel fetch all related data
  const [badgesResult, allBadgesResult, evalsResult, albumsResult, relativesResult, enrollmentsResult] =
    await Promise.all([
      supabase
        .from("student_badges")
        .select("id, awarded_at, notes, badge_id, awarded_by, badges(name, description, category, tier)")
        .eq("student_id", studentId)
        .order("awarded_at", { ascending: false }),
      supabase
        .from("badges")
        .select("id, name, category, tier")
        .eq("active", true)
        .order("category")
        .order("name"),
      supabase
        .from("student_evaluations")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_google_photo_albums")
        .select("*")
        .eq("student_id", studentId)
        .order("sort_order"),
      supabase
        .from("student_profile_relatives")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at"),
      supabase
        .from("enrollments")
        .select("id, status, classes(name, simple_name)")
        .eq("student_id", studentId)
        .in("status", ["active", "trial"]),
    ]);

  // Fetch share permissions for all relatives
  const relativeIds = (relativesResult.data ?? []).map((r) => r.id);
  const { data: permsData } =
    relativeIds.length > 0
      ? await supabase
          .from("student_profile_share_permissions")
          .select("id, relative_id, section_key, is_visible")
          .in("relative_id", relativeIds)
      : { data: [] };

  // Fetch awarded_by profile names
  const awardedByIds = [
    ...new Set(
      (badgesResult.data ?? [])
        .map((b) => b.awarded_by)
        .filter(Boolean) as string[]
    ),
  ];
  const { data: awardedByProfiles } =
    awardedByIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", awardedByIds)
      : { data: [] };

  const awardedByMap: Record<string, string> = {};
  for (const p of awardedByProfiles ?? []) {
    awardedByMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/students/${studentId}`}
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Student
        </Link>
      </div>

      <AdminStudentProfile
        student={student}
        badges={(badgesResult.data ?? []).map((b: any) => ({
          ...b,
          badges: Array.isArray(b.badges) ? b.badges[0] ?? null : b.badges,
          awardedByName: b.awarded_by ? awardedByMap[b.awarded_by] ?? null : null,
        }))}
        allBadges={allBadgesResult.data ?? []}
        evaluations={evalsResult.data ?? []}
        albums={albumsResult.data ?? []}
        relatives={relativesResult.data ?? []}
        permissions={permsData ?? []}
        tenantId={user.tenantId!}
      />
    </div>
  );
}
