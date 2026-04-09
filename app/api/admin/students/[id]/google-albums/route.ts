import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("student_google_photo_albums")
    .select("id, label, album_url, sort_order, is_active")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("sort_order");
  return NextResponse.json({ albums: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const body = await req.json().catch(() => ({}));
  const label = (body.label ?? "").trim();
  const albumUrl = (body.album_url ?? "").trim();
  if (!label || !albumUrl) {
    return NextResponse.json({ error: "label and album_url required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .single();
  if (!student?.tenant_id) {
    return NextResponse.json({ error: "Student missing tenant" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("student_google_photo_albums")
    .insert({
      tenant_id: student.tenant_id,
      student_id: studentId,
      label,
      album_url: albumUrl,
    })
    .select("id, label, album_url, sort_order, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ album: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const albumId = new URL(req.url).searchParams.get("album_id");
  if (!albumId) {
    return NextResponse.json({ error: "album_id required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("student_google_photo_albums")
    .delete()
    .eq("id", albumId)
    .eq("student_id", studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
