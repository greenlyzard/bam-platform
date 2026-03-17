import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

interface GroupMember {
  id: string;
  name: string;
  email: string | null;
  source: string; // "teacher" | "parent" | "cast_parent"
}

/**
 * GET /api/communications/channels/[id]/members/groups
 * Returns available classes and productions for bulk-add.
 * Optional ?group_type=class|production&group_id=xxx to get members of a specific group.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Must be admin or channel owner/admin
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("channel_members")
      .select("role")
      .eq("channel_id", channelId)
      .eq("profile_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const groupType = searchParams.get("group_type");
  const groupId = searchParams.get("group_id");

  // If requesting members of a specific group
  if (groupType && groupId) {
    // Get existing channel member IDs to mark who's already added
    const { data: existing } = await supabase
      .from("channel_members")
      .select("profile_id")
      .eq("channel_id", channelId);
    const existingIds = new Set((existing ?? []).map((m) => m.profile_id));

    let groupMembers: GroupMember[] = [];

    if (groupType === "class") {
      groupMembers = await getClassMembers(supabase, groupId);
    } else if (groupType === "production") {
      groupMembers = await getProductionMembers(supabase, groupId);
    }

    // Mark who is already in the channel
    const results = groupMembers.map((m) => ({
      ...m,
      already_member: existingIds.has(m.id),
    }));

    return NextResponse.json({ members: results });
  }

  // Default: return list of classes and productions
  const [classesRes, productionsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, style, level, season, teacher_id")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("productions")
      .select("id, name, season, production_type")
      .order("name"),
  ]);

  // Resolve teacher names for classes
  const teacherIds = [
    ...new Set(
      (classesRes.data ?? [])
        .map((c) => c.teacher_id)
        .filter(Boolean) as string[]
    ),
  ];

  let teacherMap: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);

    for (const t of teachers ?? []) {
      teacherMap[t.id] = [t.first_name, t.last_name]
        .filter(Boolean)
        .join(" ");
    }
  }

  const classes = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: "class" as const,
    detail: [c.style, c.level, c.season].filter(Boolean).join(" · "),
    teacher: c.teacher_id ? teacherMap[c.teacher_id] ?? null : null,
  }));

  const productions = (productionsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: "production" as const,
    detail: [p.production_type, p.season].filter(Boolean).join(" · "),
    teacher: null,
  }));

  return NextResponse.json({ groups: [...classes, ...productions] });
}

/**
 * Get class members: teacher + parents of enrolled students
 */
async function getClassMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string
): Promise<GroupMember[]> {
  const profileMap = new Map<string, GroupMember>();

  // 1. Get the class teacher
  const { data: cls } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .single();

  if (cls?.teacher_id) {
    const { data: teacher } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", cls.teacher_id)
      .single();

    if (teacher) {
      profileMap.set(teacher.id, {
        id: teacher.id,
        name: [teacher.first_name, teacher.last_name]
          .filter(Boolean)
          .join(" "),
        email: teacher.email,
        source: "teacher",
      });
    }
  }

  // 2. Get parents of enrolled students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(parent_id)")
    .eq("class_id", classId)
    .in("status", ["active", "trial"]);

  const parentIds = [
    ...new Set(
      (enrollments ?? [])
        .map((e: any) => e.students?.parent_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", parentIds);

    for (const p of parents ?? []) {
      if (!profileMap.has(p.id)) {
        profileMap.set(p.id, {
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(" "),
          email: p.email,
          source: "parent",
        });
      }
    }
  }

  return Array.from(profileMap.values());
}

/**
 * Get production members: parents of cast students
 */
async function getProductionMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productionId: string
): Promise<GroupMember[]> {
  const profileMap = new Map<string, GroupMember>();

  // Get production_dances for this production, then casting → students → parents
  const { data: dances } = await supabase
    .from("production_dances")
    .select("id")
    .eq("production_id", productionId);

  const danceIds = (dances ?? []).map((d) => d.id);

  if (danceIds.length === 0) {
    return [];
  }

  const { data: castEntries } = await supabase
    .from("casting")
    .select("student_id, students(parent_id)")
    .in("production_dance_id", danceIds);

  const parentIds = [
    ...new Set(
      (castEntries ?? [])
        .map((c: any) => c.students?.parent_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", parentIds);

    for (const p of parents ?? []) {
      profileMap.set(p.id, {
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        email: p.email,
        source: "cast_parent",
      });
    }
  }

  return Array.from(profileMap.values());
}
