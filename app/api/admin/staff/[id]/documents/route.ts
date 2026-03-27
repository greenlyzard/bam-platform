import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File;
  const documentType = form.get("document_type") as string;
  const groupName = (form.get("group_name") as string) || null;
  const notes = (form.get("notes") as string) || null;
  const tenantId = form.get("tenantId") as string;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const timestamp = Date.now();
  const path = `staff-documents/${profileId}/${timestamp}_${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadErr } = await admin.storage.from("avatars").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);

  const { data: doc, error: insertErr } = await admin.from("staff_documents").insert({
    tenant_id: tenantId,
    profile_id: profileId,
    document_type: documentType,
    group_name: groupName,
    file_name: file.name,
    file_url: publicUrl,
    file_size: file.size,
    uploaded_by: user.id,
    notes,
  }).select("id").single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ id: doc.id, url: publicUrl });
}
