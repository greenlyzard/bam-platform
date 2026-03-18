import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sendAnnouncement } from "@/lib/communications/send-announcement";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  let query = supabase
    .from("announcements")
    .select(
      "id, title, body_html, audience, audience_filter, channel, status, sent_at, recipient_count, created_at, created_by, profiles!announcements_created_by_fkey(first_name, last_name)"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (user.role === "admin" || user.role === "super_admin") {
    // Admins see all
  } else if (user.role === "teacher") {
    query = query.in("audience", ["teachers", "all"]).eq("status", "sent");
  } else {
    // Parents see announcements they received
    const { data: recipientAnnouncements } = await supabase
      .from("announcement_recipients")
      .select("announcement_id")
      .eq("profile_id", user.id);

    const announcementIds = (recipientAnnouncements ?? []).map(
      (r) => r.announcement_id
    );

    if (announcementIds.length === 0) {
      return Response.json({ announcements: [] });
    }

    query = query.in("id", announcementIds).eq("status", "sent");
  }

  const { data, error } = await query.limit(50);

  if (error) {
    console.error("[announcements:get] Error:", error);
    return Response.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }

  // For parents, include read status
  let readStatuses: Record<string, boolean> = {};
  if (user.role === "parent" || user.role === "student") {
    const { data: recipients } = await supabase
      .from("announcement_recipients")
      .select("announcement_id, read_at")
      .eq("profile_id", user.id);

    for (const r of recipients ?? []) {
      readStatuses[r.announcement_id] = !!r.read_at;
    }
  }

  const announcements = (data ?? []).map((a: any) => ({
    ...a,
    author_name: a.profiles
      ? [a.profiles.first_name, a.profiles.last_name].filter(Boolean).join(" ")
      : null,
    is_read: readStatuses[a.id] ?? true,
    profiles: undefined,
  }));

  return Response.json({ announcements });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: {
    title?: string;
    body_html?: string;
    audience?: string;
    audience_filter?: Record<string, unknown>;
    channel?: string;
    sender_name?: string;
    send?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.body_html || !body.audience) {
    return Response.json(
      { error: "title, body_html, and audience are required" },
      { status: 400 }
    );
  }

  const validAudiences = ["all_parents", "class", "season", "teachers", "all", "specific_people"];
  if (!validAudiences.includes(body.audience)) {
    return Response.json({ error: "Invalid audience" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  const { data: announcement, error: insertErr } = await supabase
    .from("announcements")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      title: body.title,
      body_html: body.body_html,
      audience: body.audience,
      audience_filter: body.audience_filter ?? null,
      channel: body.channel ?? "email",
      sender_name: body.sender_name || null,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (insertErr || !announcement) {
    console.error("[announcements:post] Insert error:", insertErr);
    return Response.json({ error: "Failed to create announcement" }, { status: 500 });
  }

  // Optionally send immediately
  if (body.send) {
    const result = await sendAnnouncement(announcement.id);
    return Response.json({
      id: announcement.id,
      status: result.success ? "sent" : "failed",
      recipient_count: result.recipientCount,
      error: result.error,
    });
  }

  return Response.json({ id: announcement.id, status: "draft" });
}
