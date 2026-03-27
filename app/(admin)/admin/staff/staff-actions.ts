"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addStaffMember(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const tenantId = formData.get("tenantId") as string;
  const sendWelcome = formData.get("sendWelcome") === "true";

  if (!firstName?.trim() || !email?.trim() || !tenantId) {
    return { error: "First name and email are required" };
  }

  // Check if profile already exists for this email
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  let profileId: string;

  if (existing) {
    profileId = existing.id;
  } else {
    // Create auth user via admin API — use service role if available, otherwise create profile directly
    // Since we use the anon key client, we create the profile record directly
    // The user will set their password when they receive the welcome email
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { first_name: firstName.trim(), last_name: lastName.trim() },
    });

    if (authErr) {
      // If admin API not available (anon key), just create profile directly
      console.warn("[addStaff] auth.admin.createUser failed:", authErr.message);
      // Try inserting profile directly
      const { data: newProfile, error: profileErr } = await supabase
        .from("profiles")
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
        })
        .select("id")
        .single();

      if (profileErr) return { error: `Could not create profile: ${profileErr.message}` };
      profileId = newProfile.id;
    } else {
      profileId = authUser.user.id;
      // Profile should be created by the auth trigger, but ensure it exists
      await supabase.from("profiles").upsert({
        id: profileId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
      }, { onConflict: "id" });
    }
  }

  // Insert role
  const { error: roleErr } = await supabase
    .from("profile_roles")
    .insert({
      user_id: profileId,
      role,
      tenant_id: tenantId,
      is_active: true,
    });

  if (roleErr && roleErr.code !== "23505") { // ignore duplicate
    return { error: `Could not assign role: ${roleErr.message}` };
  }

  // Send welcome email
  if (sendWelcome) {
    try {
      const { sendEmail } = await import("@/lib/email/send");
      await sendEmail("teacher-welcome", email.trim(), {
        first_name: firstName.trim(),
        login_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`,
      });
    } catch (e) {
      console.warn("[addStaff] Welcome email failed:", e);
    }
  }

  revalidatePath("/admin/staff");
  return { id: profileId };
}
