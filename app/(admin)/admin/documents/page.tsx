import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentsTable } from "./documents-table";

export const metadata = {
  title: "Documents — Admin",
  description: "Family document library, contracts, waivers, and uploads.",
};

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  await requireAdmin();
  const { status, type } = await searchParams;

  const supabase = createAdminClient();

  let query = supabase
    .from("family_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("document_type", type);

  const { data: documents } = await query;

  // Resolve family + student names for display
  const familyIds = Array.from(new Set((documents ?? []).map((d) => d.family_id).filter(Boolean) as string[]));
  const studentIds = Array.from(new Set((documents ?? []).map((d) => d.student_id).filter(Boolean) as string[]));

  const [{ data: families }, { data: students }] = await Promise.all([
    familyIds.length
      ? supabase.from("families").select("id, family_name").in("id", familyIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase.from("students").select("id, first_name, last_name").in("id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const familyMap: Record<string, string> = {};
  for (const f of families ?? []) familyMap[f.id] = f.family_name;
  const studentMap: Record<string, string> = {};
  for (const s of students ?? []) studentMap[s.id] = `${s.first_name} ${s.last_name}`;

  // Fetch families and students for upload modal
  const { data: allFamilies } = await supabase
    .from("families")
    .select("id, family_name")
    .order("family_name");
  const { data: allStudents } = await supabase
    .from("students")
    .select("id, first_name, last_name, family_id")
    .eq("active", true)
    .order("first_name");

  return (
    <DocumentsTable
      documents={documents ?? []}
      familyMap={familyMap}
      studentMap={studentMap}
      allFamilies={allFamilies ?? []}
      allStudents={allStudents ?? []}
      initialStatus={status ?? ""}
      initialType={type ?? ""}
    />
  );
}
