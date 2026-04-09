import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/students/[id]/documents
 * Returns family_documents filtered to this student.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const supabase = createAdminClient();

  const { data: docs, error } = await supabase
    .from("family_documents")
    .select(
      "id, title, description, document_type, status, file_url, external_url, requires_signature, signed_at, expires_at, created_at"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: docs ?? [] });
}
