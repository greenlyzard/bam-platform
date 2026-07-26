"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  EMPLOYMENT_TYPE_VALUES,
  type EmploymentType,
} from "@/lib/timesheets/employment";

export async function addStaffMember(formData: FormData) {
  // Authorization, not just authentication — this action mints accounts and
  // assigns roles via the service-role client, so it must never be reachable
  // by a signed-in non-admin. requireAdmin() redirects on failure.
  await requireAdmin();

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const tenantId = formData.get("tenantId") as string;
  const sendWelcome = formData.get("sendWelcome") === "true";

  if (!firstName?.trim() || !email?.trim() || !tenantId) {
    return { error: "First name and email are required" };
  }

  // Validate the employment type BEFORE any writes. Rejecting here is the
  // whole point — silently coercing an unrecognised value to null is how the
  // 'w2'/'1099' values went unnoticed in this form for so long.
  const rawEmploymentType =
    (formData.get("employmentType") as string | null)?.trim() || "";
  if (
    rawEmploymentType &&
    !(EMPLOYMENT_TYPE_VALUES as readonly string[]).includes(rawEmploymentType)
  ) {
    return { error: `Invalid employment type: ${rawEmploymentType}` };
  }
  const employmentType = (rawEmploymentType || null) as EmploymentType | null;

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
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: profileId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
    }, { onConflict: "id" });

    // The auth user now exists regardless. Surface this rather than swallowing
    // it — a silent failure here leaves a login with no usable profile.
    if (profileErr) {
      console.error("[addStaff] profile upsert failed:", profileErr.message);
      return {
        id: profileId,
        error: `Sign-in account was created for ${email.trim()}, but their profile could not be saved (${profileErr.message}). The account is incomplete — fix the profile before they sign in.`,
      };
    }
  }

  // Insert role
  const { error: roleErr } = await admin
    .from("profile_roles")
    .insert({ user_id: profileId, role, tenant_id: tenantId, is_active: true });

  if (roleErr && roleErr.code !== "23505") {
    return { error: `Could not assign role: ${roleErr.message}` };
  }

  // Create the staff pay record — ONLY for teaching staff. `teacher_profiles`
  // is profiles JOIN teachers, so without this row the person is invisible to
  // timesheets, payroll, and the rate editor. A non-teaching admin gets no row:
  // it would sit in the payroll list forever at zero hours.
  //
  // Idempotent via onConflict, matching the seeders in
  // 20260311000016_seed_bam_schedule.sql and scripts/seed-teachers.ts.
  if (role === "teacher") {
    const { error: teacherErr } = await admin.from("teachers").upsert(
      {
        id: profileId,
        employment_type: employmentType,
        can_be_scheduled: true,
      },
      { onConflict: "id" }
    );

    // No transaction spans createUser / profiles / profile_roles / teachers.
    // By this point the account and role exist and are usable for sign-in, so
    // reporting a bare success would hide that payroll is broken for them.
    if (teacherErr) {
      console.error("[addStaff] teachers upsert failed:", teacherErr.message);
      return {
        id: profileId,
        error: `${firstName.trim()} was created and can sign in, but their staff pay record could not be saved (${teacherErr.message}). They will not appear in timesheets or payroll until it is added from their staff profile.`,
      };
    }
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
  await requireAdmin();

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
  await requireAdmin();

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
