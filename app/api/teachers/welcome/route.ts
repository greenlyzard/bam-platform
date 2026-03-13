import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { renderEmailHtml } from "@/lib/email/layout";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";
const FROM_NAME = "Ballet Academy and Movement";
const PORTAL_URL = "https://portal.balletacademyandmovement.com";

export async function POST(req: NextRequest) {
  await requireAdmin();
  const supabase = await createClient();

  const { teacher_id } = await req.json();
  if (!teacher_id) {
    return NextResponse.json(
      { error: "teacher_id is required" },
      { status: 400 }
    );
  }

  // Get teacher profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", teacher_id)
    .single();

  if (!profile?.email) {
    return NextResponse.json(
      { error: "Teacher has no email address" },
      { status: 400 }
    );
  }

  // Generate a magic link for the teacher (72hr expiry)
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        redirectTo: `${PORTAL_URL}/teach/dashboard`,
      },
    });

  if (linkError) {
    return NextResponse.json(
      { error: linkError.message },
      { status: 500 }
    );
  }

  const magicLink =
    linkData?.properties?.action_link ?? `${PORTAL_URL}/login`;
  const firstName = profile.first_name ?? "Teacher";

  const html = renderEmailHtml({
    headerText: "Welcome to Ballet Academy and Movement",
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>Your teacher portal account is ready! Here's everything you need to get started:</p>
      <ul>
        <li><strong>Portal URL:</strong> <a href="${PORTAL_URL}" style="color: #9C8BBF;">${PORTAL_URL}</a></li>
        <li><strong>Your email:</strong> ${profile.email}</li>
      </ul>
      <p>Click the button below to access your teacher portal and set up your account. This link is valid for 72 hours.</p>
      <p style="margin-top: 24px;">Once you're in, you can:</p>
      <ul>
        <li>View your class schedule and student rosters</li>
        <li>Log your teaching hours and submit timesheets</li>
        <li>Communicate with parents through the portal</li>
        <li>Chat with Angelina, our AI studio assistant</li>
      </ul>
      <p>If you have any questions, reach out to Amanda at <a href="mailto:dance@bamsocal.com" style="color: #9C8BBF;">dance@bamsocal.com</a>.</p>
      <p>Welcome to the team!</p>
    `,
    buttonText: "Access Your Teacher Portal",
    buttonUrl: magicLink,
    footerText: "Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672",
  });

  const { error: sendError } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [profile.email],
    subject: "Welcome to Ballet Academy and Movement — Your Teacher Portal is Ready",
    html,
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: profile.email });
}
