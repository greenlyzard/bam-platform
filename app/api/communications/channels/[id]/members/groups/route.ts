import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

interface GroupMember {
  id: string;
  name: string;
  email: string | null;
  source: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime12h(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatClassLabel(cls: {
  name: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
}): string {
  if (cls.day_of_week != null && cls.start_time && cls.end_time) {
    const day = DAY_NAMES[cls.day_of_week];
    return `${day} ${formatTime12h(cls.start_time)}\u2013${formatTime12h(cls.end_time)} \u00b7 ${cls.name}`;
  }
  return cls.name;
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

    if (groupType === "preset") {
      groupMembers = await getPresetMembers(supabase, channelId, groupId);
    } else if (groupType === "class") {
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
      .select("id, name, style, level, season, teacher_id, day_of_week, start_time, end_time")
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time")
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
    name: formatClassLabel(c),
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

  const presets = [
    { id: "all_teachers", name: "All Teachers", type: "preset" as const, detail: "All active teachers", teacher: null },
    { id: "all_parents", name: "All Parents", type: "preset" as const, detail: "All active parents", teacher: null },
    { id: "all_staff", name: "All Staff", type: "preset" as const, detail: "All admins and teachers", teacher: null },
  ];

  return NextResponse.json({ groups: [...presets, ...classes, ...productions] });
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
    .select("student_id, role, students(parent_id, first_name, last_name)")
    .in("production_dance_id", danceIds);

  // Build a map of parent_id → best casting info (student name + role)
  const parentCastInfo = new Map<string, { studentName: string; role: string }>();
  for (const c of castEntries ?? []) {
    const student = (c as any).students;
    if (!student?.parent_id) continue;
    const studentName = [student.first_name, student.last_name].filter(Boolean).join(" ");
    const existing = parentCastInfo.get(student.parent_id);
    // Keep the first one found (or could combine, but first is fine)
    if (!existing) {
      parentCastInfo.set(student.parent_id, { studentName, role: c.role });
    }
  }

  const parentIds = [...parentCastInfo.keys()];

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", parentIds);

    for (const p of parents ?? []) {
      const info = parentCastInfo.get(p.id);
      const source = info
        ? `Parent of ${info.studentName} (${info.role})`
        : "Cast Parent";
      profileMap.set(p.id, {
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        email: p.email,
        source,
      });
    }
  }

  return Array.from(profileMap.values());
}

/**
 * Get preset group members by role from profile_roles, scoped to channel's tenant
 */
async function getPresetMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelId: string,
  presetId: string
): Promise<GroupMember[]> {
  // Get tenant_id from the channel
  const { data: channel } = await supabase
    .from("channels")
    .select("tenant_id")
    .eq("id", channelId)
    .single();

  if (!channel?.tenant_id) return [];

  const roleFilter: Record<string, string[]> = {
    all_teachers: ["teacher"],
    all_parents: ["parent"],
    all_staff: ["admin", "super_admin", "teacher", "front_desk"],
  };

  const roles = roleFilter[presetId];
  if (!roles) return [];

  const { data: roleEntries } = await supabase
    .from("profile_roles")
    .select("user_id, role")
    .eq("tenant_id", channel.tenant_id)
    .eq("is_active", true)
    .in("role", roles);

  const userIds = [...new Set((roleEntries ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", userIds);

  // Build a role label map
  const roleLabels: Record<string, string> = {};
  for (const r of roleEntries ?? []) {
    if (!roleLabels[r.user_id]) {
      roleLabels[r.user_id] = r.role;
    }
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" "),
    email: p.email,
    source: roleLabels[p.id] ?? presetId,
  }));
}
