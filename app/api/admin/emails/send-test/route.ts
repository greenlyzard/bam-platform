import { createClient } from "@/lib/supabase/server";
import { renderEmailHtml, DEFAULT_LOGO_URL } from "@/lib/email/layout";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_REPLY_TO = "dance@bamsocal.com";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    from_name,
    from_email,
    reply_to,
    subject,
    header_text,
    body_html,
    button_text,
    button_url,
    footer_text,
  } = body;

  if (!subject || !body_html) {
    return NextResponse.json(
      { error: "Subject and body are required" },
      { status: 400 }
    );
  }

  const recipientEmail = profile.email ?? user.email;
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "No email address found for your account" },
      { status: 400 }
    );
  }

  // Replace sample variables for test
  const sampleVars: Record<string, string> = {
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com",
    student_name: "Sofia Martinez",
    class_name: "Ballet Level 1",
    class_time: "4:00 PM",
    class_day: "Mondays",
    class_room: "Studio A",
    teacher_name: "Ms. Amanda",
    trial_date: "March 18, 2026",
    performance_name: "The Nutcracker 2026",
    performance_details: "December 12–14, 2026 at the San Clemente Community Center.",
    magic_link: "#test-magic-link",
  };

  const replacePlaceholders = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, key) => sampleVars[key] ?? match);

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

  const html = renderEmailHtml({
    headerText: header_text ? replacePlaceholders(header_text) : null,
    bodyHtml: replacePlaceholders(body_html),
    buttonText: button_text ? replacePlaceholders(button_text) : null,
    buttonUrl: button_url ? replacePlaceholders(button_url) : null,
    footerText: footer_text || null,
    logoUrl,
  });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error: sendError } = await resend.emails.send({
    from: `${from_name || "Ballet Academy and Movement"} <${from_email || "hello@balletacademyandmovement.com"}>`,
    to: recipientEmail,
    replyTo: reply_to || DEFAULT_REPLY_TO,
    subject: `[TEST] ${replacePlaceholders(subject)}`,
    html,
  });

  if (sendError) {
    console.error("[admin:sendTestEmail]", sendError);
    return NextResponse.json(
      { error: sendError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, sentTo: recipientEmail });
}
