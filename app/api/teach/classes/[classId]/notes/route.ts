import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const body = await req.json();
  const { content, note_type, teacher_id, tenant_id } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("class_notes")
    .insert({
      class_id: classId,
      teacher_id,
      tenant_id,
      content: content.trim(),
      note_type: note_type || "general",
      note_date: today,
    })
    .select("id, content, note_type, note_date, is_private, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch teacher name for the response
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", teacher_id)
    .single();

  const teacherName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Unknown";

  return NextResponse.json({
    note: {
      id: data.id,
      content: data.content,
      noteType: data.note_type,
      noteDate: data.note_date,
      isPrivate: data.is_private,
      createdAt: data.created_at,
      teacherName,
    },
  });
}
