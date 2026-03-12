import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // Get embed config (public — no auth required)
  const { data: embed, error: embedError } = await supabase
    .from("schedule_embeds")
    .select("*")
    .eq("embed_token", token)
    .single();

  if (embedError || !embed) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");

  // Calculate week range
  let monday: Date;
  if (weekParam) {
    monday = new Date(weekParam + "T00:00:00");
  } else {
    monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
  }
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const startDate = monday.toISOString().split("T")[0];
  const endDate = saturday.toISOString().split("T")[0];

  // Fetch instances for the week
  let query = supabase
    .from("schedule_instances")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .in("status", ["published", "notified"])
    .order("event_date")
    .order("start_time");

  // Apply embed defaults: hide rehearsals unless configured
  if (!embed.show_rehearsals) {
    query = query.neq("event_type", "rehearsal");
  }

  if (embed.show_trials_only) {
    query = query.eq("is_trial_eligible", true);
  }

  const { data: instances, error: instanceError } = await query;

  if (instanceError) {
    console.error("[widget:schedule:GET]", instanceError);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }

  if (!instances || instances.length === 0) {
    return NextResponse.json({
      data: { instances: [], embed },
    });
  }

  // Enrich with class info, teacher names, room names
  const classIds = [...new Set(instances.map((i) => i.class_id).filter(Boolean) as string[])];
  const teacherIds = [
    ...new Set(
      instances.flatMap((i) => [i.teacher_id, i.substitute_teacher_id]).filter(Boolean) as string[]
    ),
  ];
  const roomIds = [...new Set(instances.map((i) => i.room_id).filter(Boolean) as string[])];

  const classInfo: Record<string, Record<string, unknown>> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, level, style, age_min, age_max, discipline")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classInfo[c.id] = c;
    }
  }

  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  const roomNames: Record<string, string> = {};
  if (roomIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name")
      .in("id", roomIds);
    for (const r of rooms ?? []) {
      roomNames[r.id] = r.name;
    }
  }

  const enriched = instances.map((i) => ({
    ...i,
    className: i.class_id ? (classInfo[i.class_id]?.name ?? null) : null,
    teacherName: i.teacher_id ? (teacherNames[i.teacher_id] ?? null) : null,
    substituteTeacherName: i.substitute_teacher_id
      ? (teacherNames[i.substitute_teacher_id] ?? null)
      : null,
    roomName: i.room_id ? (roomNames[i.room_id] ?? null) : null,
    level: i.class_id ? ((classInfo[i.class_id]?.level as string) ?? null) : null,
    style: i.class_id ? ((classInfo[i.class_id]?.style as string) ?? null) : null,
    ageMin: i.class_id ? ((classInfo[i.class_id]?.age_min as number) ?? null) : null,
    ageMax: i.class_id ? ((classInfo[i.class_id]?.age_max as number) ?? null) : null,
    discipline: i.class_id ? ((classInfo[i.class_id]?.discipline as string) ?? null) : null,
  }));

  // Fetch seasons for filter dropdown
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .order("start_date", { ascending: false });

  return NextResponse.json({
    data: {
      instances: enriched,
      embed,
      seasons: seasons ?? [],
    },
  });
}
