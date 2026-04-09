import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminStudentProfile } from "./admin-student-profile";
import { detectAndUpsertOpportunities } from "@/lib/opportunities/detect-opportunities";

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
        .select("id, status, classes(name)")
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

  // ── Curriculum skills — active season for tenant ──
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("tenant_id", student.tenant_id)
    .eq("is_active", true)
    .maybeSingle();

  let curriculumSkills: Array<{
    id: string;
    name: string;
    description: string | null;
    badge_color_hex: string | null;
    sort_order: number;
    category_id: string;
    category_name: string;
    category_sort: number;
  }> = [];
  let skillRecords: Array<{
    skill_id: string;
    status: string;
    rating: number | null;
    awarded_at: string | null;
  }> = [];

  if (activeSeason && student.current_level) {
    // PostgREST has no FK relationship between season_curriculum →
    // curriculum_skills → curriculum_categories in this DB. Fetch in 3 steps.
    const { data: scRows } = await supabase
      .from("season_curriculum")
      .select("id, sort_order, skill_id")
      .eq("season_id", activeSeason.id)
      .eq("level_tag", student.current_level)
      .order("sort_order");

    const skillIds = (scRows ?? []).map((r) => r.skill_id).filter(Boolean) as string[];

    const { data: skillsRows } = skillIds.length
      ? await supabase
          .from("curriculum_skills")
          .select("id, name, description, badge_color_hex, category_id")
          .in("id", skillIds)
      : { data: [] };

    const categoryIds = Array.from(
      new Set((skillsRows ?? []).map((s) => s.category_id).filter(Boolean) as string[])
    );

    const { data: catsRows } = categoryIds.length
      ? await supabase
          .from("curriculum_categories")
          .select("id, name, sort_order")
          .in("id", categoryIds)
      : { data: [] };

    type SkillRow = {
      id: string;
      name: string;
      description: string | null;
      badge_color_hex: string | null;
      category_id: string | null;
    };
    const skillMap = new Map<string, SkillRow>();
    for (const s of (skillsRows ?? []) as SkillRow[]) skillMap.set(s.id, s);

    const catMap = new Map<string, { id: string; name: string; sort_order: number | null }>();
    for (const c of catsRows ?? []) catMap.set(c.id, c);

    for (const row of scRows ?? []) {
      const skill = row.skill_id ? skillMap.get(row.skill_id) : null;
      if (!skill) continue;
      const cat = skill.category_id ? catMap.get(skill.category_id) : null;
      curriculumSkills.push({
        id: skill.id,
        name: skill.name,
        description: skill.description ?? null,
        badge_color_hex: skill.badge_color_hex ?? null,
        sort_order: row.sort_order ?? 0,
        category_id: cat?.id ?? "uncategorized",
        category_name: cat?.name ?? "Uncategorized",
        category_sort: cat?.sort_order ?? 0,
      });
    }

    if (curriculumSkills.length > 0) {
      const { data: recs } = await supabase
        .from("student_skill_records")
        .select("skill_id, status, rating, awarded_at")
        .eq("student_id", studentId)
        .eq("season_id", activeSeason.id);
      skillRecords = recs ?? [];
    }
  }

  // Detect + load opportunities (admin client bypasses RLS)
  const adminDb = createAdminClient();
  if (student.tenant_id) {
    try {
      await detectAndUpsertOpportunities(student.tenant_id, studentId);
    } catch (e) {
      console.error("[opportunities] detect failed:", e);
    }
  }
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: oppRows } = await adminDb
    .from("student_opportunities")
    .select("id, opportunity_type, title, description, action_label, action_url, snoozed_until, expires_at")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  const opportunities = (oppRows ?? []).filter((o) => {
    if (o.snoozed_until && o.snoozed_until >= todayStr) return false;
    if (o.expires_at && o.expires_at <= todayStr) return false;
    return true;
  });

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
        opportunities={opportunities}
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
        activeSeason={activeSeason ?? null}
        curriculumSkills={curriculumSkills}
        skillRecords={skillRecords}
      />
    </div>
  );
}
