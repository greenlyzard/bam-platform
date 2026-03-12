import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ParentMessagesView } from "./ParentMessagesView";

export default async function MessagesPage() {
  const user = await requireParent();
  const supabase = await createClient();

  // Get announcements the parent has received
  const { data: recipientRows } = await supabase
    .from("announcement_recipients")
    .select(
      "announcement_id, read_at, announcements(id, title, body_html, sent_at, created_at)"
    )
    .eq("profile_id", user.id)
    .order("announcements(created_at)", { ascending: false })
    .limit(20);

  const announcements = (recipientRows ?? [])
    .filter((r: any) => r.announcements)
    .map((r: any) => ({
      id: r.announcements.id,
      title: r.announcements.title,
      body_html: r.announcements.body_html,
      sent_at: r.announcements.sent_at ?? r.announcements.created_at,
      is_read: !!r.read_at,
    }));

  // Get children's enrolled class teachers for "New Message" recipient list
  const { data: children } = await supabase
    .from("students")
    .select("id, first_name")
    .eq("parent_id", user.id)
    .eq("active", true);

  const studentIds = (children ?? []).map((c) => c.id);
  let teacherOptions: Array<{
    id: string;
    name: string;
    class_name: string;
  }> = [];

  if (studentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id, classes(name, teacher_id)")
      .in("student_id", studentIds)
      .in("status", ["active", "trial"]);

    const teacherIds = [
      ...new Set(
        (enrollments ?? [])
          .map((e: any) => e.classes?.teacher_id)
          .filter(Boolean) as string[]
      ),
    ];

    if (teacherIds.length > 0) {
      const { data: teachers } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", teacherIds);

      const teacherMap: Record<string, string> = {};
      for (const t of teachers ?? []) {
        teacherMap[t.id] = [t.first_name, t.last_name]
          .filter(Boolean)
          .join(" ");
      }

      // Build teacher options with class context
      const seen = new Set<string>();
      for (const e of enrollments ?? []) {
        const cls = (e as any).classes;
        if (!cls?.teacher_id || seen.has(cls.teacher_id)) continue;
        seen.add(cls.teacher_id);
        teacherOptions.push({
          id: cls.teacher_id,
          name: teacherMap[cls.teacher_id] ?? "Teacher",
          class_name: cls.name,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Messages
        </h1>
        <p className="mt-1 text-sm text-slate">
          Studio announcements and conversations with your dancers&apos;
          teachers.
        </p>
      </div>

      <ParentMessagesView
        announcements={announcements}
        teacherOptions={teacherOptions}
        userId={user.id}
      />
    </div>
  );
}
