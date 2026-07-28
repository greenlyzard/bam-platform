"use server";

import { requireAdmin, ADMIN_TIER_ROLES } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  EMPLOYMENT_TYPE_VALUES,
  type EmploymentType,
} from "@/lib/timesheets/employment";
import {
  isStaffRole,
  staffRoleLabel,
  legacyProfileRole,
} from "@/lib/auth/staff-roles";

export async function addStaffMember(formData: FormData) {
  // Authorization, not just authentication — this action mints accounts and
  // assigns roles via the service-role client, so it must never be reachable
  // by a signed-in non-admin. requireAdmin() redirects on failure.
  const caller = await requireAdmin();

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const tenantId = formData.get("tenantId") as string;
  const sendWelcome = formData.get("sendWelcome") === "true";

  if (!firstName?.trim() || !email?.trim() || !tenantId) {
    return { error: "First name and email are required" };
  }

  // A staff member may hold several roles at once — profile_roles carries one
  // row per role. Validate the whole set BEFORE any writes: this action mints
  // an auth user, and a role rejected halfway through would leave an account
  // behind with the wrong access.
  const roles = [
    ...new Set(
      formData
        .getAll("roles")
        .map((r) => String(r).trim())
        .filter(Boolean)
    ),
  ];

  if (roles.length === 0) {
    return { error: "Select at least one role" };
  }
  const unknown = roles.filter((r) => !isStaffRole(r));
  if (unknown.length > 0) {
    return { error: `Invalid role: ${unknown.join(", ")}` };
  }

  // Escalation gate, mirroring addStaffRole in the staff profile actions.
  // Every role in ADMIN_TIER_ROLES satisfies is_admin() in RLS and
  // requireAdmin() in the app, so granting one is a privilege escalation and
  // is reserved to super_admin. Without this the Add Staff form would be a
  // way around the gate on the edit path — a plain admin could simply create
  // a new account holding super_admin.
  const adminTier = roles.filter((r) =>
    (ADMIN_TIER_ROLES as readonly string[]).includes(r)
  );
  if (adminTier.length > 0 && !caller.roles?.includes("super_admin")) {
    return {
      error: `Only Studio Owners can assign this role: ${adminTier
        .map(staffRoleLabel)
        .join(", ")}`,
    };
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

  // One profile_roles row per selected role. Upserting on the unique key
  // (user_id, tenant_id, role) makes re-submission idempotent — and reactivates
  // a role that was previously deactivated rather than colliding with it.
  const { error: roleErr } = await admin.from("profile_roles").upsert(
    roles.map((role) => ({
      user_id: profileId,
      role,
      tenant_id: tenantId,
      is_active: true,
    })),
    { onConflict: "user_id,tenant_id,role" }
  );

  if (roleErr) {
    return { error: `Could not assign roles: ${roleErr.message}` };
  }

  // LEGACY MIRROR. profile_roles above is authoritative for authorization;
  // profiles.role is a single-role enum column that still backs roughly thirty
  // API routes, so it is collapsed from the person's full active role set and
  // kept in step. Read the effective set back rather than mirroring only what
  // this form submitted — the upsert is additive, so an existing Studio Owner
  // added here as a teacher must not be demoted to 'teacher' in the mirror.
  const { data: activeRoles, error: readbackErr } = await admin
    .from("profile_roles")
    .select("role")
    .eq("user_id", profileId)
    .eq("is_active", true);

  const effectiveRoles = readbackErr
    ? roles
    : (activeRoles ?? []).map((r) => r.role);

  const { error: mirrorErr } = await admin
    .from("profiles")
    .update({ role: legacyProfileRole(effectiveRoles) })
    .eq("id", profileId);

  // Not fatal — profile_roles is what governs access, and the account is
  // usable without the mirror. Log loudly so the drift is traceable.
  if (mirrorErr) {
    console.error(
      "[addStaff] legacy profiles.role mirror failed:",
      mirrorErr.message
    );
  }

  // Create the staff pay record — ONLY when teacher is among the selected
  // roles. `teacher_profiles` is profiles JOIN teachers, so without this row
  // the person is invisible to timesheets, payroll, and the rate editor. A
  // non-teaching admin gets no row: it would sit in the payroll list forever
  // at zero hours.
  //
  // Insert-if-missing rather than upsert: an existing teachers row already
  // carries pay rates, compliance flags and an employment type, and blindly
  // upserting would wipe its employment_type back to null when this form is
  // re-submitted for someone who already teaches. teachers.id IS the profile
  // id (no separate profile_id / user_id column).
  if (roles.includes("teacher")) {
    const { data: existingTeacher, error: teacherLookupErr } = await admin
      .from("teachers")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();

    // No transaction spans createUser / profiles / profile_roles / teachers.
    // By this point the account and roles exist and are usable for sign-in, so
    // reporting a bare success would hide that payroll is broken for them.
    if (teacherLookupErr) {
      console.error(
        "[addStaff] teachers lookup failed:",
        teacherLookupErr.message
      );
      return {
        id: profileId,
        error: `${firstName.trim()} was created and can sign in, but their staff pay record could not be checked (${teacherLookupErr.message}). Confirm it exists from their staff profile before running payroll.`,
      };
    }

    if (!existingTeacher) {
      const { error: teacherErr } = await admin.from("teachers").insert({
        id: profileId,
        employment_type: employmentType,
        can_be_scheduled: true,
        is_active: true,
      });

      // 23505 = the row was created concurrently. Nothing to fix.
      if (teacherErr && teacherErr.code !== "23505") {
        console.error("[addStaff] teachers insert failed:", teacherErr.message);
        return {
          id: profileId,
          error: `${firstName.trim()} was created and can sign in, but their staff pay record could not be saved (${teacherErr.message}). They will not appear in timesheets or payroll until it is added from their staff profile.`,
        };
      }
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
