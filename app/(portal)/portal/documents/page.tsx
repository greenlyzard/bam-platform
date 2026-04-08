import { requireParent } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentsView } from "./documents-view";

export const metadata = { title: "Documents" };

export default async function PortalDocumentsPage() {
  const user = await requireParent();
  const supabase = createAdminClient();

  // Find family IDs the user has access to
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, family_id")
    .eq("parent_id", user.id);

  const familyIds = Array.from(
    new Set((students ?? []).map((s) => s.family_id).filter(Boolean) as string[])
  );

  let documents: Array<{
    id: string;
    family_id: string | null;
    student_id: string | null;
    document_type: string;
    title: string;
    description: string | null;
    status: string;
    expires_at: string | null;
    requires_signature: boolean;
    file_url: string | null;
    external_url: string | null;
    created_at: string;
    signed_at: string | null;
  }> = [];

  if (familyIds.length > 0) {
    const { data } = await supabase
      .from("family_documents")
      .select("id, family_id, student_id, document_type, title, description, status, expires_at, requires_signature, file_url, external_url, created_at, signed_at")
      .in("family_id", familyIds)
      .eq("visible_to_parent", true)
      .neq("status", "voided")
      .order("created_at", { ascending: false });
    documents = data ?? [];
  }

  const studentMap: Record<string, string> = {};
  for (const s of students ?? []) {
    studentMap[s.id] = `${s.first_name} ${s.last_name}`;
  }

  return <DocumentsView documents={documents} studentMap={studentMap} />;
}
