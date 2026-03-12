"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/resend/emails";
import { renderEmailHtml } from "@/lib/email/layout";

export async function inviteTeamMember(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Forbidden" };
  }

  const email = formData.get("email") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const role = formData.get("role") as string;

  if (!email || !firstName || !lastName || !role) {
    return { error: "All fields are required" };
  }

  // Check if user already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return { error: "A user with this email already exists" };
  }

  // Create invite record
  const { data: invite, error: insertError } = await supabase
    .from("staff_invites")
    .insert({
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      invited_by: user.id,
    })
    .select("token")
    .single();

  if (insertError) return { error: insertError.message };

  // Send invite email via Resend
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";
  const setupUrl = `${appUrl}/auth/accept-invite?token=${invite.token}`;

  const html = renderEmailHtml({
    headerText: "You're Invited!",
    bodyHtml: `<p>Hi ${firstName},</p>
<p>You've been invited to join Ballet Academy &amp; Movement as a <strong>${role.replace(/_/g, " ")}</strong>.</p>
<p>Click the button below to set up your account. This link expires in 7 days.</p>`,
    buttonText: "Set Up Your Account",
    buttonUrl: setupUrl,
  });

  try {
    await sendEmail({
      to: email,
      subject: "You're invited to Ballet Academy & Movement",
      html,
    });
  } catch {
    // Invite was created — email failure is non-fatal
    console.error("[team:invite] Failed to send invite email");
  }

  revalidatePath("/admin/settings/team");
  return { success: true };
}

export async function approveTeacher(profileId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || !["admin", "super_admin"].includes(adminProfile.role)) {
    return { error: "Forbidden" };
  }

  // Update approval status
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ approval_status: "active" })
    .eq("id", profileId)
    .eq("approval_status", "pending_approval");

  if (updateError) return { error: updateError.message };

  // Get teacher info for welcome email
  const { data: teacher } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", profileId)
    .single();

  if (teacher?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";
    const html = renderEmailHtml({
      headerText: "Welcome to the Team!",
      bodyHtml: `<p>Hi ${teacher.first_name ?? "there"},</p>
<p>Your account has been approved! You can now sign in to the Teacher Portal to view your schedule, log hours, and manage your classes.</p>`,
      buttonText: "Go to Teacher Portal",
      buttonUrl: `${appUrl}/teach/dashboard`,
    });

    try {
      await sendEmail({
        to: teacher.email,
        subject: "Your account is approved — Ballet Academy & Movement",
        html,
      });
    } catch {
      console.error("[team:approve] Failed to send welcome email");
    }
  }

  revalidatePath("/admin/settings/team");
  return { success: true };
}

export async function rejectTeacher(profileId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || !["admin", "super_admin"].includes(adminProfile.role)) {
    return { error: "Forbidden" };
  }

  // Get teacher info for rejection email
  const { data: teacher } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", profileId)
    .single();

  // Mark as rejected
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ approval_status: "rejected" })
    .eq("id", profileId)
    .eq("approval_status", "pending_approval");

  if (updateError) return { error: updateError.message };

  if (teacher?.email) {
    const html = renderEmailHtml({
      headerText: "Application Update",
      bodyHtml: `<p>Hi ${teacher.first_name ?? "there"},</p>
<p>Thank you for your interest in joining Ballet Academy &amp; Movement. After review, we're unable to approve your account at this time.</p>
<p>If you believe this was a mistake, please contact us at <a href="mailto:dance@bamsocal.com" style="color:#9C8BBF;">dance@bamsocal.com</a>.</p>`,
    });

    try {
      await sendEmail({
        to: teacher.email,
        subject: "Application update — Ballet Academy & Movement",
        html,
      });
    } catch {
      console.error("[team:reject] Failed to send rejection email");
    }
  }

  revalidatePath("/admin/settings/team");
  return { success: true };
}
