import { createClient } from "@/lib/supabase/server";

interface SendNotificationParams {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  channels?: ("in_app" | "email" | "sms" | "push")[];
}

export async function sendNotification(params: SendNotificationParams) {
  const supabase = await createClient();
  const channels = params.channels ?? ["in_app", "push", "email"];

  // Check preferences for each channel
  for (const channel of channels) {
    const enabled = await isChannelEnabled(
      supabase,
      params.userId,
      params.type,
      channel
    );
    if (!enabled) continue;

    try {
      switch (channel) {
        case "in_app":
          await sendInApp(supabase, params);
          break;
        case "push":
          await sendPush(supabase, params);
          break;
        case "email":
          await sendEmailNotif(supabase, params);
          break;
        case "sms":
          await sendSMS(supabase, params);
          break;
      }
    } catch (e) {
      console.warn(`[notifications:${channel}] Failed for ${params.userId}:`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_DEFAULT_TYPES = new Set([
  "announcement",
  "billing",
  "evaluation",
  "private_confirmed",
]);

async function isChannelEnabled(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: string,
  channel: "in_app" | "email" | "sms" | "push"
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("notification_preferences")
      .select("enabled")
      .eq("user_id", userId)
      .eq("notification_type", type)
      .eq("channel", channel)
      .maybeSingle();

    if (data) return data.enabled;

    // Defaults when no preference row exists
    if (channel === "in_app" || channel === "push") return true;
    if (channel === "email") return EMAIL_DEFAULT_TYPES.has(type);
    if (channel === "sms") return false;
    return true;
  } catch {
    // Table may not exist yet — default to enabled for in_app/push
    return channel === "in_app" || channel === "push";
  }
}

async function sendInApp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: SendNotificationParams
) {
  await supabase.from("notifications").insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    icon: params.icon ?? null,
    data: params.data ?? null,
  });
}

async function sendPush(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: SendNotificationParams
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  let webpush: typeof import("web-push");
  try {
    webpush = await import("web-push");
  } catch {
    // web-push not installed — skip
    return;
  }

  webpush.setVapidDetails(
    "mailto:dance@bamsocal.com",
    publicKey,
    privateKey
  );

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", params.userId)
    .eq("is_active", true);

  if (!subscriptions?.length) return;

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    icon: params.icon,
    data: params.data,
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (e) {
      // Remove stale subscriptions (410 Gone)
      const err = e as { statusCode?: number };
      if (err.statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("endpoint", sub.endpoint);
      }
    }
  }
}

async function sendEmailNotif(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: SendNotificationParams
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", params.userId)
    .single();

  if (!profile?.email) return;

  const html = `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #6B5A99;">${params.title}</h2>
      <p style="color: #333; line-height: 1.6;">${params.body}</p>
    </div>
  `;

  // Try primary email module, fall back to resend
  try {
    const { sendEmail } = await import("@/lib/resend/emails");
    await sendEmail({ to: profile.email, subject: params.title, html });
  } catch (e) {
    console.warn("[notifications:email] Could not send:", e);
  }
}

async function sendSMS(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: SendNotificationParams
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", params.userId)
    .single();

  if (!profile?.phone) return;

  try {
    const { getSMSAdapter } = await import("@/lib/sms/adapter");
    const adapter = await getSMSAdapter(params.tenantId);
    await adapter.sendMessage(profile.phone, `${params.title}\n${params.body}`);
  } catch (e) {
    console.warn("[notifications:sms] Could not send:", e);
  }
}
