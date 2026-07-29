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

  const classId = req.nextUrl.searchParams.get("classId");
  const date = req.nextUrl.searchParams.get("date");
  // The occurrence whose attendance to load. Optional, because the caller picks
  // the class and date first and only then learns which occurrences exist.
  const instanceId = req.nextUrl.searchParams.get("instanceId");

  if (!classId) {
    return NextResponse.json(
      { error: "classId is required" },
      { status: 400 }
    );
  }

  // Verify teacher owns this class
  const { data: classData } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    // Also allow admins
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fetch roster
  const { data: roster } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      student_id,
      students (id, first_name, last_name, current_level, medical_notes)
    `
    )
    .eq("class_id", classId)
    .in("status", ["active", "trial"])
    .order("created_at");

  // Fetch the class occurrences on this date.
  //
  // A class can meet more than once in a day, so this is a LIST, never a lookup.
  // The caller must choose which occurrence it means; this route deliberately
  // does not choose for it — picking the first match is the bug that keying
  // attendance on (class_id, class_date) caused in the first place.
  interface Occurrence {
    id: string;
    event_date: string;
    start_time: string;
    end_time: string;
    status: string;
  }
  let occurrences: Occurrence[] = [];
  if (date) {
    const { data: occ } = await supabase
      .from("schedule_instances")
      .select("id, event_date, start_time, end_time, status")
      .eq("class_id", classId)
      .eq("event_date", date)
      .eq("event_type", "class")
      .neq("status", "cancelled")
      .order("start_time");
    occurrences = occ ?? [];
  }

  // Fetch existing attendance for the chosen occurrence.
  //
  // Matched ONLY on schedule_instance_id. Matching on (class_id, class_date)
  // would return the other occurrence's roster statuses alongside this one's and
  // silently merge two sessions into one.
  //
  // The id must be one of the occurrences just resolved for this class. The
  // ownership check above covers `classId`; without this, an arbitrary instance
  // id in the query string would read attendance for a class the caller was
  // never authorized against.
  let attendance: { id: string; student_id: string; status: string }[] = [];
  if (instanceId && occurrences.some((o) => o.id === instanceId)) {
    const { data: att } = await supabase
      .from("attendance")
      .select("id, student_id, status")
      .eq("schedule_instance_id", instanceId);
    attendance = att ?? [];
  }

  return NextResponse.json({ roster: roster ?? [], attendance, occurrences });
}
