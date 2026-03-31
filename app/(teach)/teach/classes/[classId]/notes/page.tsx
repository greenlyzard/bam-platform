import { requireTeacher } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotesClient } from "./notes-client";

export default async function ClassNotesPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireTeacher();
  const { classId } = await params;
  const supabase = createAdminClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .single();

  // Fetch notes if table exists
  let notes: any[] = [];
  try {
    const { data } = await supabase
      .from("class_notes")
      .select("id, content, note_type, note_date, is_private, created_at, teacher_id, profiles(first_name, last_name)")
      .eq("class_id", classId)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    notes = data ?? [];
  } catch {
    // Table may not exist yet
  }

  return (
    <NotesClient
      classId={classId}
      className={cls?.name ?? "Class"}
      teacherId={user.id}
      tenantId={user.tenantId!}
      initialNotes={notes.map((n: any) => ({
        id: n.id,
        content: n.content,
        noteType: n.note_type,
        noteDate: n.note_date,
        isPrivate: n.is_private,
        createdAt: n.created_at,
        teacherName: n.profiles
          ? [n.profiles.first_name, n.profiles.last_name].filter(Boolean).join(" ")
          : "Unknown",
      }))}
    />
  );
}
