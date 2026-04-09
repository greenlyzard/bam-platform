import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, current_level, tenant_id")
    .eq("id", studentId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("tenant_id", student.tenant_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!activeSeason || !student.current_level) {
    return NextResponse.json({
      activeSeason: activeSeason ?? null,
      level: student.current_level,
      skills: [],
      records: [],
    });
  }

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

  const skillMap = new Map<string, { id: string; name: string; description: string | null; badge_color_hex: string | null; category_id: string | null }>();
  for (const s of skillsRows ?? []) skillMap.set(s.id, s as never);
  const catMap = new Map<string, { id: string; name: string; sort_order: number | null }>();
  for (const c of catsRows ?? []) catMap.set(c.id, c);

  const skills = (scRows ?? [])
    .map((row) => {
      const s = row.skill_id ? skillMap.get(row.skill_id) : null;
      if (!s) return null;
      const cat = s.category_id ? catMap.get(s.category_id) : null;
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        badge_color_hex: s.badge_color_hex,
        sort_order: row.sort_order ?? 0,
        category_name: cat?.name ?? "Uncategorized",
        category_sort: cat?.sort_order ?? 0,
      };
    })
    .filter(Boolean);

  const { data: records } = await supabase
    .from("student_skill_records")
    .select("skill_id, status, awarded_at")
    .eq("student_id", studentId)
    .eq("season_id", activeSeason.id);

  return NextResponse.json({
    activeSeason,
    level: student.current_level,
    skills,
    records: records ?? [],
  });
}
