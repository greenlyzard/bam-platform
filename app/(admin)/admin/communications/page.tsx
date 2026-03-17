import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CommunicationsDashboard } from "./CommunicationsDashboard";

export default async function CommunicationsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const isAdmin = ["super_admin", "admin"].includes(user.role);

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  // Fetch recent announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select(
      "id, title, audience, channel, status, sent_at, recipient_count, created_at, created_by, profiles!announcements_created_by_fkey(first_name, last_name)"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);

  const formattedAnnouncements = (announcements ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    audience: a.audience,
    channel: a.channel,
    status: a.status,
    sent_at: a.sent_at,
    recipient_count: a.recipient_count,
    created_at: a.created_at,
    author_name: a.profiles
      ? [a.profiles.first_name, a.profiles.last_name].filter(Boolean).join(" ")
      : "Unknown",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Communications
          </h1>
          <p className="mt-1 text-sm text-slate">
            Channels, announcements, and the unified inbox.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/communications/inbox"
            className="inline-flex h-10 items-center rounded-lg border border-silver px-5 text-sm font-medium text-slate hover:bg-cloud transition-colors"
          >
            Inbox
          </a>
          <a
            href="/admin/communications/new"
            className="inline-flex h-10 items-center rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
          >
            New Announcement
          </a>
        </div>
      </div>

      <CommunicationsDashboard
        announcements={formattedAnnouncements}
        userId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
