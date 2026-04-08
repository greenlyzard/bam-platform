import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const supabase = createAdminClient();

  let query = supabase
    .from("family_documents")
    .select("*")
    .order("created_at", { ascending: false });

  const familyId = searchParams.get("family_id");
  const studentId = searchParams.get("student_id");
  const docType = searchParams.get("document_type");
  const status = searchParams.get("status");
  const seasonId = searchParams.get("season_id");

  if (familyId) query = query.eq("family_id", familyId);
  if (studentId) query = query.eq("student_id", studentId);
  if (docType) query = query.eq("document_type", docType);
  if (status) query = query.eq("status", status);
  if (seasonId) query = query.eq("season_id", seasonId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const {
    family_id, student_id, document_type, title, description,
    file_url, external_url, file_size_bytes,
    requires_signature, expires_at,
    visible_to_parent, visible_to_student,
    admin_notes, enrollment_id, season_id, contract_template_id,
  } = body ?? {};

  if (!document_type || !title) {
    return NextResponse.json({ error: "document_type and title are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const initialStatus = requires_signature ? "pending" : "uploaded";

  const { data, error } = await supabase
    .from("family_documents")
    .insert({
      tenant_id: user.tenantId!,
      family_id: family_id ?? null,
      student_id: student_id ?? null,
      document_type,
      title,
      description: description ?? null,
      file_url: file_url ?? null,
      external_url: external_url ?? null,
      file_size_bytes: file_size_bytes ?? null,
      requires_signature: !!requires_signature,
      expires_at: expires_at ?? null,
      visible_to_parent: visible_to_parent ?? true,
      visible_to_student: visible_to_student ?? false,
      uploaded_by: user.id,
      uploaded_on_behalf: true,
      admin_notes: admin_notes ?? null,
      enrollment_id: enrollment_id ?? null,
      season_id: season_id ?? null,
      contract_template_id: contract_template_id ?? null,
      status: initialStatus,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push notification if signature required
  if (requires_signature && family_id && data?.visible_to_parent) {
    const { data: family } = await supabase
      .from("families")
      .select("primary_contact_id")
      .eq("id", family_id)
      .single();
    if (family?.primary_contact_id) {
      await supabase.from("notifications").insert({
        tenant_id: user.tenantId!,
        recipient_id: family.primary_contact_id,
        notification_type: "document_signature_required",
        title: "New document needs your signature",
        body: title,
        metadata: { document_id: data.id },
      });
    }
  }

  return NextResponse.json({ document: data });
}
