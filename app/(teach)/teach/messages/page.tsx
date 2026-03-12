import { requireTeacher } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { TeacherMessagesView } from "./TeacherMessagesView";

export default async function MessagesPage() {
  const user = await requireTeacher();
  const supabase = await createClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  // Get teacher-targeted announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body_html, sent_at, created_at")
    .eq("tenant_id", tenantId)
    .in("audience", ["teachers", "all"])
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(20);

  const formattedAnnouncements = (announcements ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    body_html: a.body_html,
    sent_at: a.sent_at ?? a.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Messages
        </h1>
        <p className="mt-1 text-sm text-slate">
          Studio announcements and parent conversations.
        </p>
      </div>

      <TeacherMessagesView
        announcements={formattedAnnouncements}
        userId={user.id}
      />
    </div>
  );
}
