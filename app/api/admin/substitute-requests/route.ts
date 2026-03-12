import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  let query = supabase
    .from("substitute_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data: requests, error } = await query;

  if (error) {
    console.error("[api:substitute-requests:GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch substitute requests" },
      { status: 500 }
    );
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Enrich with instance details and teacher names
  const instanceIds = [...new Set(requests.map((r) => r.instance_id))];
  const teacherIds = [
    ...new Set(
      requests
        .flatMap((r) => [r.requesting_teacher_id, r.filled_by])
        .filter(Boolean) as string[]
    ),
  ];

  const instanceMap: Record<string, Record<string, unknown>> = {};
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("schedule_instances")
      .select("id, event_date, start_time, end_time, class_id")
      .in("id", instanceIds);
    for (const inst of instances ?? []) {
      instanceMap[inst.id] = inst;
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

  const classIds = [
    ...new Set(
      Object.values(instanceMap)
        .map((i) => i.class_id as string)
        .filter(Boolean)
    ),
  ];
  const classNames: Record<string, string> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classNames[c.id] = c.name;
    }
  }

  const enriched = requests.map((r) => {
    const inst = instanceMap[r.instance_id];
    return {
      ...r,
      requesting_teacher_name: teacherNames[r.requesting_teacher_id] ?? null,
      filled_by_name: r.filled_by ? (teacherNames[r.filled_by] ?? null) : null,
      event_date: inst?.event_date ?? null,
      start_time: inst?.start_time ?? null,
      end_time: inst?.end_time ?? null,
      class_name: inst?.class_id
        ? (classNames[inst.class_id as string] ?? null)
        : null,
    };
  });

  return NextResponse.json({ data: enriched });
}
