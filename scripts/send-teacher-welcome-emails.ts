/**
 * Send welcome emails to all teachers who haven't received one yet.
 *
 * Reads teacher_profiles where welcome_sent_at IS NULL,
 * calls /api/teachers/welcome for each, and updates the timestamp.
 *
 * Usage:
 *   npx tsx scripts/send-teacher-welcome-emails.ts
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Also requires the app to be running (calls the API route).
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually
try {
  const envFile = readFileSync(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "hello@balletacademyandmovement.com";
const PORTAL_URL = "https://portal.balletacademyandmovement.com";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.error("Missing env: RESEND_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Sending welcome emails to teachers...\n");

  // Fetch teachers without welcome emails
  const { data: teachers, error } = await supabase
    .from("teacher_profiles")
    .select("id, user_id, first_name, last_name, email")
    .is("welcome_sent_at", null)
    .eq("is_active", true);

  if (error) {
    console.error("Failed to fetch teachers:", error.message);
    process.exit(1);
  }

  if (!teachers || teachers.length === 0) {
    console.log("No teachers need welcome emails. All done!");
    return;
  }

  console.log(`Found ${teachers.length} teachers to email:\n`);

  let sent = 0;
  let failed = 0;

  // Dynamic import for Resend
  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_API_KEY);

  for (const t of teachers) {
    const name = [t.first_name, t.last_name].filter(Boolean).join(" ") || "Teacher";
    console.log(`  Sending to ${name} (${t.email})...`);

    // Generate magic link
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: t.email,
        options: {
          redirectTo: `${PORTAL_URL}/teach/dashboard`,
        },
      });

    if (linkError) {
      console.error(`    FAILED (magic link): ${linkError.message}`);
      failed++;
      continue;
    }

    const magicLink =
      linkData?.properties?.action_link ?? `${PORTAL_URL}/login`;

    // Send email
    const { error: sendError } = await resend.emails.send({
      from: `Ballet Academy and Movement <${FROM_EMAIL}>`,
      to: [t.email],
      subject:
        "Welcome to Ballet Academy and Movement — Your Teacher Portal is Ready",
      html: `
        <div style="font-family: Montserrat, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background: #FAF8F3;">
          <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; color: #333; font-size: 24px; margin-bottom: 24px;">
            Welcome to Ballet Academy and Movement
          </h1>
          <p>Hi ${t.first_name ?? "there"},</p>
          <p>Your teacher portal account is ready! Here's everything you need to get started:</p>
          <ul>
            <li><strong>Portal URL:</strong> <a href="${PORTAL_URL}" style="color: #9C8BBF;">${PORTAL_URL}</a></li>
            <li><strong>Your email:</strong> ${t.email}</li>
          </ul>
          <p>Click the button below to access your teacher portal. This link is valid for 72 hours.</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${magicLink}" style="display: inline-block; background: #9C8BBF; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              Access Your Teacher Portal
            </a>
          </p>
          <p>Once you're in, you can:</p>
          <ul>
            <li>View your class schedule and student rosters</li>
            <li>Log your teaching hours and submit timesheets</li>
            <li>Communicate with parents through the portal</li>
          </ul>
          <p>If you have any questions, reach out to Amanda at <a href="mailto:dance@bamsocal.com" style="color: #9C8BBF;">dance@bamsocal.com</a>.</p>
          <p>Welcome to the team!</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;" />
          <p style="font-size: 12px; color: #999;">
            Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672
          </p>
        </div>
      `,
    });

    if (sendError) {
      console.error(`    FAILED (send): ${sendError.message}`);
      failed++;
      continue;
    }

    // Update welcome_sent_at
    await supabase
      .from("teacher_profiles")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", t.id);

    console.log(`    Sent!`);
    sent++;
  }

  console.log(`\nDone! Sent: ${sent}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Send failed:", err);
  process.exit(1);
});
