import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderEmailHtml, DEFAULT_LOGO_URL } from "@/lib/email/layout";

const DEFAULT_REPLY_TO = "dance@bamsocal.com";
const FROM_EMAIL = "hello@balletacademyandmovement.com";
const STUDIO_NAME = "Ballet Academy and Movement";

/**
 * Resolve recipients, send emails, and update announcement status.
 */
export async function sendAnnouncement(announcementId: string): Promise<{
  success: boolean;
  recipientCount: number;
  error?: string;
}> {
  const supabase = await createClient();

  // Fetch announcement
  const { data: announcement, error: fetchErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", announcementId)
    .single();

  if (fetchErr || !announcement) {
    return { success: false, recipientCount: 0, error: "Announcement not found" };
  }

  // Mark as sending
  await supabase
    .from("announcements")
    .update({ status: "sending" })
    .eq("id", announcementId);

  // Fetch logo URL from studio_settings
  let logoUrl = DEFAULT_LOGO_URL;
  try {
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("logo_url")
      .limit(1)
      .single();
    if (settings?.logo_url) logoUrl = settings.logo_url;
  } catch { /* use default */ }

  // Build from field based on sender_name
  const fromField = announcement.sender_name
    ? `${announcement.sender_name} via ${STUDIO_NAME} <${FROM_EMAIL}>`
    : `${STUDIO_NAME} <${FROM_EMAIL}>`;

  try {
    // Resolve recipient profile IDs based on audience
    const recipientProfiles = await resolveRecipients(
      supabase,
      announcement.tenant_id,
      announcement.audience,
      announcement.audience_filter
    );

    if (recipientProfiles.length === 0) {
      await supabase
        .from("announcements")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: 0 })
        .eq("id", announcementId);
      return { success: true, recipientCount: 0 };
    }

    // Insert recipient rows
    const recipientRows = recipientProfiles.map((p) => ({
      announcement_id: announcementId,
      profile_id: p.id,
      email: p.email,
      status: "pending" as const,
    }));

    await supabase.from("announcement_recipients").insert(recipientRows);

    // Send emails if channel is 'email' or 'both'
    if (announcement.channel === "email" || announcement.channel === "both") {
      const html = renderEmailHtml({
        headerText: announcement.title,
        bodyHtml: announcement.body_html,
        buttonText: "View in Portal",
        buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com"}/portal/messages`,
        logoUrl,
      });

      const emailRecipients = recipientProfiles
        .filter((p) => p.email)
        .map((p) => p.email as string);

      if (emailRecipients.length > 0 && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);

        // Send in batches of 50
        for (let i = 0; i < emailRecipients.length; i += 50) {
          const batch = emailRecipients.slice(i, i + 50);
          const batchEmails = batch.map((to) => ({
            from: fromField,
            to,
            replyTo: DEFAULT_REPLY_TO,
            subject: announcement.title,
            html,
          }));

          try {
            await resend.batch.send(batchEmails);

            // Mark batch as sent
            await supabase
              .from("announcement_recipients")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("announcement_id", announcementId)
              .in("email", batch);
          } catch (err) {
            console.error("[announcement:send] Batch error:", err);
            await supabase
              .from("announcement_recipients")
              .update({ status: "failed" })
              .eq("announcement_id", announcementId)
              .in("email", batch);
          }
        }
      }
    }

    // For in_app or both, the recipient rows themselves serve as notifications
    // (status = 'sent' for email, 'pending' for in-app-only until read)
    if (announcement.channel === "in_app") {
      await supabase
        .from("announcement_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("announcement_id", announcementId);
    }

    // Update announcement
    await supabase
      .from("announcements")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: recipientProfiles.length,
      })
      .eq("id", announcementId);

    return { success: true, recipientCount: recipientProfiles.length };
  } catch (err) {
    console.error("[announcement:send] Error:", err);
    await supabase
      .from("announcements")
      .update({ status: "failed" })
      .eq("id", announcementId);
    return {
      success: false,
      recipientCount: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  audience: string,
  audienceFilter: Record<string, unknown> | null
): Promise<Array<{ id: string; email: string | null }>> {
  const profileSet = new Map<string, string | null>();

  if (audience === "all_parents" || audience === "all") {
    const { data: parentRoles } = await supabase
      .from("profile_roles")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "parent")
      .eq("is_active", true);

    const parentIds = (parentRoles ?? []).map((pr) => pr.user_id);
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", parentIds);
      for (const p of parents ?? []) {
        profileSet.set(p.id, p.email);
      }
    }
  }

  if (audience === "teachers" || audience === "all") {
    const { data: teacherRoles } = await supabase
      .from("profile_roles")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "teacher")
      .eq("is_active", true);

    const teacherIds = (teacherRoles ?? []).map((tr) => tr.user_id);
    if (teacherIds.length > 0) {
      const { data: teachers } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", teacherIds);
      for (const t of teachers ?? []) {
        profileSet.set(t.id, t.email);
      }
    }
  }

  if (audience === "class" && audienceFilter) {
    const classIds = (audienceFilter as { class_ids?: string[] }).class_ids ?? [];
    if (classIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, students(parent_id)")
        .in("class_id", classIds)
        .in("status", ["active", "trial"]);

      const parentIds = [
        ...new Set(
          (enrollments ?? [])
            .map((e: any) => e.students?.parent_id)
            .filter(Boolean) as string[]
        ),
      ];

      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", parentIds);
        for (const p of parents ?? []) {
          profileSet.set(p.id, p.email);
        }
      }
    }
  }

  if (audience === "season" && audienceFilter) {
    const seasonId = (audienceFilter as { season_id?: string }).season_id;
    if (seasonId) {
      // Get classes in season via schedule_templates
      const { data: templates } = await supabase
        .from("schedule_templates")
        .select("class_id")
        .eq("season_id", seasonId)
        .eq("is_active", true);

      const classIds = [...new Set((templates ?? []).map((t) => t.class_id))];
      if (classIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("student_id, students(parent_id)")
          .in("class_id", classIds)
          .in("status", ["active", "trial"]);

        const parentIds = [
          ...new Set(
            (enrollments ?? [])
              .map((e: any) => e.students?.parent_id)
              .filter(Boolean) as string[]
          ),
        ];

        if (parentIds.length > 0) {
          const { data: parents } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", parentIds);
          for (const p of parents ?? []) {
            profileSet.set(p.id, p.email);
          }
        }
      }
    }
  }

  return Array.from(profileSet.entries()).map(([id, email]) => ({ id, email }));
}
