"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function addStaffMember(formData: FormData) {
  // Verify caller is authenticated admin
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

  // Use admin client for all writes (bypasses RLS)
  const admin = createAdminClient();

  // Check if profile already exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  let profileId: string;

  if (existing) {
    profileId = existing.id;
  } else {
    // Create auth user via service role admin API
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { first_name: firstName.trim(), last_name: lastName.trim() },
    });

    if (authErr) {
      console.error("[addStaff] createUser failed:", authErr.message);
      return { error: `Could not create user: ${authErr.message}` };
    }

    profileId = authUser.user.id;

    // Ensure profile exists (auth trigger may create it, but upsert to be safe)
    await admin.from("profiles").upsert({
      id: profileId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
    }, { onConflict: "id" });
  }

  // Insert role
  const { error: roleErr } = await admin
    .from("profile_roles")
    .insert({ user_id: profileId, role, tenant_id: tenantId, is_active: true });

  if (roleErr && roleErr.code !== "23505") {
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

export async function updateStaffOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const orderedIds = JSON.parse(formData.get("orderedIds") as string ?? "[]") as string[];
  if (orderedIds.length === 0) return { error: "No IDs provided" };

  const admin = createAdminClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await admin
      .from("profiles")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/staff");
  return {};
}

export async function resetStaffOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenantId") as string;
  if (!tenantId) return { error: "Missing tenantId" };

  // Get all staff profile IDs for this tenant
  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("profile_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["teacher", "admin", "super_admin"]);

  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (ids.length > 0) {
    await admin.from("profiles").update({ sort_order: null }).in("id", ids);
  }

  revalidatePath("/admin/staff");
  return {};
}
