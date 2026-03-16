import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teacherId = request.nextUrl.searchParams.get("teacherId");
  const date = request.nextUrl.searchParams.get("date");

  if (!teacherId || !date) {
    return NextResponse.json(
      { error: "teacherId and date are required" },
      { status: 400 }
    );
  }

  const { data: instances, error } = await supabase
    .from("schedule_instances")
    .select(
      "id, event_type, event_date, start_time, end_time, class_id, production_id, notes, classes(id, name)"
    )
    .eq("tenant_id", TENANT_ID)
    .eq("teacher_id", teacherId)
    .eq("event_date", date)
    .not("status", "eq", "cancelled")
    .order("start_time");

  if (error) {
    console.error("[api/admin/schedule-instances]", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule instances" },
      { status: 500 }
    );
  }

  const formatted = (instances ?? []).map((si) => {
    const cls = si.classes as unknown as { id: string; name: string } | null;
    return {
      id: si.id,
      event_type: si.event_type,
      event_date: si.event_date,
      start_time: si.start_time,
      end_time: si.end_time,
      class_id: si.class_id,
      class_name: cls?.name ?? null,
      production_id: si.production_id,
      notes: si.notes,
    };
  });

  return NextResponse.json({ instances: formatted });
}
