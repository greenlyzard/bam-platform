import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "student-photos";

/** GET — list all photos for a student */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin.storage.from(BUCKET).list(studentId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    // Bucket may not exist yet — return empty list rather than failing
    return NextResponse.json({ photos: [] });
  }

  const photos = (data ?? [])
    .filter((f) => !f.name.startsWith("."))
    .map((f) => {
      const path = `${studentId}/${f.name}`;
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
      return {
        name: f.name,
        path,
        url: urlData.publicUrl,
        created_at: f.created_at,
      };
    });

  return NextResponse.json({ photos });
}

/** POST — upload one photo */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 10MB" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${studentId}/${ts}-${safeName}`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ success: true, url: urlData.publicUrl, path });
}

/** DELETE — remove a photo by path (passed as ?path=) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith(`${studentId}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
