import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/resend/emails";
import { renderEmailHtml } from "@/lib/email/layout";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, firstName, lastName, phone } = body;

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  // Create auth user with teacher role and pending status
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/callback?redirect=/teach/dashboard`,
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "teacher",
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Set approval_status to pending_approval, update phone
  if (data.user) {
    await supabase
      .from("profiles")
      .update({
        approval_status: "pending_approval",
        phone: phone || null,
        first_name: firstName,
        last_name: lastName,
      })
      .eq("id", data.user.id);
  }

  // Notify admins about the new teacher signup
  const { data: admins } = await supabase
    .from("profiles")
    .select("email, first_name")
    .in("role", ["admin", "super_admin"])
    .eq("approval_status", "active");

  if (admins && admins.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";
    const html = renderEmailHtml({
      headerText: "New Teacher Signup",
      bodyHtml: `<p>A new teacher has signed up and is pending approval:</p>
<p><strong>${firstName} ${lastName}</strong><br>${email}${phone ? `<br>${phone}` : ""}</p>
<p>Please review their application in the admin settings.</p>`,
      buttonText: "Review Applications",
      buttonUrl: `${appUrl}/admin/settings/team`,
    });

    for (const admin of admins) {
      if (admin.email) {
        try {
          await sendEmail({
            to: admin.email,
            subject: `New teacher signup: ${firstName} ${lastName} is pending approval`,
            html,
          });
        } catch {
          console.error("[teacher-signup] Failed to notify admin:", admin.email);
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
