import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classId = request.nextUrl.searchParams.get("classId");

  // When no classId — return all active students (used for private lessons)
  if (!classId) {
    // Verify caller is admin
    const { data: role } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["admin", "super_admin", "studio_admin", "finance_admin", "studio_manager", "teacher"])
      .limit(1)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: allStudents, error } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name");

    if (error) {
      console.error("[api/teach/students] all students", error);
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
    }

    return NextResponse.json({
      students: (allStudents ?? []).map((s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
      })),
    });
  }

  // Verify teacher owns this class or caller is admin
  const { data: classData } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    const { data: role } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["admin", "super_admin", "studio_admin", "finance_admin", "studio_manager"])
      .limit(1)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select("student_id, students(id, first_name, last_name)")
    .eq("class_id", classId)
    .in("status", ["active", "trial"])
    .order("created_at");

  if (error) {
    console.error("[api/teach/students]", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }

  const students = (enrollments ?? []).map((e) => {
    const s = e.students as unknown as { id: string; first_name: string; last_name: string };
    return {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
    };
  });

  return NextResponse.json({ students });
}
