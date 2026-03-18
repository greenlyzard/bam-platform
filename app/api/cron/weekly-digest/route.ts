import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import {
  buildDigestForParent,
  renderDigestEmail,
  getNextMonday,
} from "@/lib/email/templates/weekly-digest";
import { DEFAULT_LOGO_URL } from "@/lib/email/layout";

const DEFAULT_REPLY_TO = "dance@bamsocal.com";
const FROM = "Ballet Academy and Movement <hello@balletacademyandmovement.com>";

/**
 * GET /api/cron/weekly-digest
 * Triggered by Vercel cron every Sunday at 10 AM Pacific.
 * Sends personalized weekly digest emails for the upcoming week (next Monday–Sunday).
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Next Monday = start of upcoming week
  const weekStart = getNextMonday(new Date());

  // Fetch logo
  let logoUrl = DEFAULT_LOGO_URL;
  try {
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("logo_url")
      .limit(1)
      .single();
    if (settings?.logo_url) logoUrl = settings.logo_url;
  } catch { /* use default */ }

  // Get all parents with active enrollments
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(parent_id)")
    .in("status", ["active", "trial"]);

  const parentIds = [
    ...new Set(
      (enrollments ?? [])
        .map((e: any) => e.students?.parent_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (parentIds.length === 0 || !process.env.RESEND_API_KEY) {
    return NextResponse.json({
      success: true,
      sent: 0,
      reason: parentIds.length === 0 ? "no_parents" : "no_api_key",
      timestamp: new Date().toISOString(),
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;

  // Process in batches of 10
  for (let i = 0; i < parentIds.length; i += 10) {
    const batch = parentIds.slice(i, i + 10);

    const emailBatch: Array<{
      from: string;
      to: string;
      replyTo: string;
      subject: string;
      html: string;
    }> = [];

    for (const pid of batch) {
      const data = await buildDigestForParent(supabase, pid, weekStart);
      if (!data) continue;

      const { data: parent } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", pid)
        .single();

      if (!parent?.email) continue;

      emailBatch.push({
        from: FROM,
        to: parent.email,
        replyTo: DEFAULT_REPLY_TO,
        subject: `Your Weekly Schedule — ${data.weekLabel}`,
        html: renderDigestEmail(data, logoUrl),
      });
    }

    if (emailBatch.length > 0) {
      try {
        await resend.batch.send(emailBatch);
        sent += emailBatch.length;
      } catch (err) {
        console.error("[cron:weekly-digest] Batch send error:", err);
        failed += emailBatch.length;
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: parentIds.length,
    timestamp: new Date().toISOString(),
  });
}
