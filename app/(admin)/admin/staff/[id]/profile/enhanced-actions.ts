"use server";

import { ADMIN_TIER_ROLES, requireAdmin } from "@/lib/auth/guards";
import { isStaffRole, legacyProfileRole, staffRoleLabel } from "@/lib/auth/staff-roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * LEGACY MIRROR. `profile_roles` is authoritative for authorization; this keeps
 * the stale single-value `profiles.role` enum column in step, because roughly
 * thirty API routes still read it. Without it, granting or removing a role here
 * leaves the mirror pointing at whatever the person's role was years ago —
 * which is how Cara ends up with profiles.role = 'parent' while holding admin.
 *
 * Reads the effective active set back rather than mirroring only the role that
 * was just changed: both call sites are single-role edits against a person who
 * commonly holds several, so the submitted role alone would demote them.
 *
 * Uses the admin client so neither the read-back nor the write can be silently
 * narrowed by RLS on profiles — a partial read here would collapse the mirror
 * to a lower role. Failure is non-fatal: profile_roles already governs access.
 *
 * `fallbackRoles` is used only if the read-back itself fails, and only where a
 * safe floor is known (the grant path knows the roles it just wrote). Omit it
 * on the removal path — there the remaining set is unknown, and guessing would
 * write 'parent' over a Studio Owner on a transient read error. Skipping leaves
 * the mirror stale, which is the same state it was in before this call.
 */
async function syncLegacyProfileRole(profileId: string, fallbackRoles?: string[]) {
  const admin = createAdminClient();

  const { data: activeRoles, error: readbackErr } = await admin
    .from("profile_roles")
    .select("role")
    .eq("user_id", profileId)
    .eq("is_active", true);

  if (readbackErr) {
    console.error(
      "[syncLegacyProfileRole] role read-back failed:",
      readbackErr.message
    );
    if (!fallbackRoles) return;
  }

  const effectiveRoles = readbackErr
    ? fallbackRoles!
    : (activeRoles ?? []).map((r) => r.role);

  const { error: mirrorErr } = await admin
    .from("profiles")
    .update({ role: legacyProfileRole(effectiveRoles) })
    .eq("id", profileId);

  if (mirrorErr) {
    console.error(
      "[syncLegacyProfileRole] legacy profiles.role mirror failed:",
      mirrorErr.message
    );
  }
}

// ---------------------------------------------------------------------------
// 1. Update enhanced bio fields on profiles
// ---------------------------------------------------------------------------
export async function updateEnhancedBio(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  const yearsRaw = formData.get("years_experience") as string;
  const yearsExperience = yearsRaw && yearsRaw.trim() !== "" ? Number(yearsRaw) : null;

  const payload = {
    title: (formData.get("title") as string) || null,
    bio_short: (formData.get("bio_short") as string) || null,
    bio_full: (formData.get("bio_full") as string) || null,
    years_experience: yearsExperience,
    education: (formData.get("education") as string) || null,
    social_instagram: (formData.get("social_instagram") as string) || null,
    social_linkedin: (formData.get("social_linkedin") as string) || null,
  };

  console.log("[updateEnhancedBio] teacherId:", teacherId, "payload:", JSON.stringify(payload));

  // Use plain update without .select().single() — avoids RLS issues on the read-back
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", teacherId);

  console.log("[updateEnhancedBio] error:", error?.message ?? "none");

  if (error) return { error: error.message };

  // Verify the update took effect
  const { data: verify } = await supabase
    .from("profiles")
    .select("title, bio_short")
    .eq("id", teacherId)
    .single();

  console.log("[updateEnhancedBio] verify:", verify);

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${teacherId}/profile`);
  return {};
}

// ---------------------------------------------------------------------------
// 2. Add discipline
// ---------------------------------------------------------------------------
export async function addDiscipline(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const tenantId = formData.get("tenantId") as string;
  const teacherId = formData.get("teacherId") as string;
  const name = formData.get("name") as string;

  if (!tenantId || !teacherId || !name) {
    return { error: "Missing required fields" };
  }

  const iconId = (formData.get("icon_id") as string) || null;
  const isCertified = formData.get("is_certified") === "true";

  // Get current max sort_order for this teacher
  const { data: existing } = await supabase
    .from("teacher_disciplines")
    .select("sort_order")
    .eq("teacher_id", teacherId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from("teacher_disciplines")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherId,
      icon_id: iconId,
      name,
      is_certified: isCertified,
      sort_order: nextOrder,
    });

  if (error) return { error: error.message };

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 3. Remove discipline
// ---------------------------------------------------------------------------
export async function removeDiscipline(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const disciplineId = formData.get("disciplineId") as string;
  if (!disciplineId) return { error: "Missing disciplineId" };

  const { error } = await supabase
    .from("teacher_disciplines")
    .delete()
    .eq("id", disciplineId);

  if (error) return { error: error.message };

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 4. Reorder disciplines
// ---------------------------------------------------------------------------
export async function reorderDisciplines(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(formData.get("orderedIds") as string);
  } catch {
    return { error: "Invalid orderedIds JSON" };
  }

  // Update each discipline's sort_order based on its position in the array
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("teacher_disciplines")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("teacher_id", teacherId);

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 5. Add affiliation
// ---------------------------------------------------------------------------
export async function addAffiliation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const tenantId = formData.get("tenantId") as string;
  const teacherId = formData.get("teacherId") as string;
  const name = formData.get("name") as string;
  const affiliationType = formData.get("affiliation_type") as string;

  if (!tenantId || !teacherId || !name || !affiliationType) {
    return { error: "Missing required fields" };
  }

  const iconId = (formData.get("icon_id") as string) || null;

  // Get current max sort_order for this teacher
  const { data: existing } = await supabase
    .from("teacher_affiliations")
    .select("sort_order")
    .eq("teacher_id", teacherId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from("teacher_affiliations")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherId,
      icon_id: iconId,
      name,
      affiliation_type: affiliationType,
      role: (formData.get("role") as string) || null,
      years: (formData.get("years") as string) || null,
      location: (formData.get("location") as string) || null,
      description: (formData.get("description") as string) || null,
      sort_order: nextOrder,
    });

  if (error) return { error: error.message };

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 6. Remove affiliation
// ---------------------------------------------------------------------------
export async function removeAffiliation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const affiliationId = formData.get("affiliationId") as string;
  if (!affiliationId) return { error: "Missing affiliationId" };

  const { error } = await supabase
    .from("teacher_affiliations")
    .delete()
    .eq("id", affiliationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 7. Reorder affiliations
// ---------------------------------------------------------------------------
export async function reorderAffiliations(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(formData.get("orderedIds") as string);
  } catch {
    return { error: "Invalid orderedIds JSON" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("teacher_affiliations")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("teacher_id", teacherId);

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 8. Upload teacher photo
// ---------------------------------------------------------------------------
export async function uploadTeacherPhoto(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const tenantId = formData.get("tenantId") as string;
  const teacherId = formData.get("teacherId") as string;
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) || null;

  if (!tenantId || !teacherId || !file) {
    return { error: "Missing required fields" };
  }

  // Determine file extension from the original filename
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const timestamp = Date.now();
  const storagePath = `teacher-photos/${teacherId}/${timestamp}.${ext}`;

  // Upload to Supabase Storage using admin client (bypasses RLS)
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  // Get the public URL
  const { data: urlData } = admin.storage
    .from("avatars")
    .getPublicUrl(storagePath);

  const photoUrl = urlData.publicUrl;

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("teacher_photos")
    .select("sort_order")
    .eq("teacher_id", teacherId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  // Insert record
  const { data: inserted, error: insertError } = await supabase
    .from("teacher_photos")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherId,
      photo_url: photoUrl,
      caption,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath("/admin/staff");
  return { id: inserted.id, url: photoUrl };
}

// ---------------------------------------------------------------------------
// 9. Update photo caption
// ---------------------------------------------------------------------------
export async function updatePhotoCaption(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const photoId = formData.get("photoId") as string;
  if (!photoId) return { error: "Missing photoId" };

  const caption = (formData.get("caption") as string) || null;

  const { error } = await supabase
    .from("teacher_photos")
    .update({ caption })
    .eq("id", photoId);

  if (error) return { error: error.message };

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 10. Delete photo
// ---------------------------------------------------------------------------
export async function deletePhoto(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const photoId = formData.get("photoId") as string;
  if (!photoId) return { error: "Missing photoId" };

  // Fetch the photo record to get the storage path
  const { data: photo, error: fetchError } = await supabase
    .from("teacher_photos")
    .select("photo_url")
    .eq("id", photoId)
    .single();

  if (fetchError) return { error: fetchError.message };

  // Delete from database first
  const { error } = await supabase
    .from("teacher_photos")
    .delete()
    .eq("id", photoId);

  if (error) return { error: error.message };

  // Attempt to delete from storage (best-effort)
  if (photo?.photo_url) {
    // Extract the storage path from the public URL
    // Public URLs follow: .../storage/v1/object/public/teacher-photos/<path>
    const marker = "/teacher-photos/";
    const idx = photo.photo_url.indexOf(marker);
    if (idx !== -1) {
      const storagePath = "teacher-photos/" + photo.photo_url.slice(idx + marker.length);
      await createAdminClient().storage.from("avatars").remove([storagePath]);
    }
  }

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 11. Reorder photos
// ---------------------------------------------------------------------------
export async function reorderPhotos(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return { error: "Missing teacherId" };

  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(formData.get("orderedIds") as string);
  } catch {
    return { error: "Invalid orderedIds JSON" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("teacher_photos")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("teacher_id", teacherId);

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 12. Toggle photo active status
// ---------------------------------------------------------------------------
export async function togglePhotoActive(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const photoId = formData.get("photoId") as string;
  const isActive = formData.get("isActive") === "true";
  if (!photoId) return { error: "Missing photoId" };

  const { error } = await supabase
    .from("teacher_photos")
    .update({ is_active: isActive })
    .eq("id", photoId);

  if (error) return { error: error.message };

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 13. Add staff roles
// ---------------------------------------------------------------------------
/**
 * Grants one or more roles in a single call. Roles arrive as repeated "roles"
 * entries, matching the multi-select on the Add Staff Member form — a person
 * holds one profile_roles row per role and commonly holds several.
 */
export async function addStaffRole(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const profileId = formData.get("profileId") as string;
  const tenantId = formData.get("tenantId") as string;
  const roles = [
    ...new Set(
      formData
        .getAll("roles")
        .map((r) => String(r).trim())
        .filter(Boolean)
    ),
  ];

  if (!profileId || !tenantId) return { error: "Missing required fields" };
  if (roles.length === 0) return { error: "Select at least one role" };

  const unknown = roles.filter((r) => !isStaffRole(r));
  if (unknown.length > 0) return { error: `Invalid role: ${unknown.join(", ")}` };

  // Escalation gate. Granting ANY admin-tier role is a privilege escalation —
  // every role in ADMIN_TIER_ROLES satisfies is_admin() in RLS and
  // requireAdmin() in the app — so it is reserved to super_admin. A plain
  // admin retains normal staff management: teacher, parent, student,
  // front_desk. Checked across the whole selection before any insert, so a
  // mixed selection cannot slip an admin-tier role in beside a permitted one.
  //
  // NOTE on front_desk: deliberately left grantable by a plain admin, but it
  // routes to /admin/dashboard (see roleHome in lib/auth/guards.ts) while
  // requireAdmin() excludes it. That inconsistency is unresolved — if
  // front_desk should be admin-tier, add it to ADMIN_TIER_ROLES and is_admin()
  // together, not here.
  const adminTier = roles.filter((r) => (ADMIN_TIER_ROLES as readonly string[]).includes(r));
  if (adminTier.length > 0) {
    const { data: callerRole } = await supabase.from("profile_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").eq("is_active", true).maybeSingle();
    if (!callerRole) return { error: `Only Studio Owners can assign this role: ${adminTier.map(staffRoleLabel).join(", ")}` };
  }

  // Upsert on the unique key (user_id, tenant_id, role) so re-granting a role
  // the person already holds is a no-op rather than a 23505.
  const { error } = await supabase.from("profile_roles").upsert(
    roles.map((role) => ({ user_id: profileId, role, tenant_id: tenantId, is_active: true })),
    { onConflict: "user_id,tenant_id,role" }
  );
  if (error) return { error: error.message };

  // The roles just granted are a safe floor if the read-back fails — the upsert
  // above has already committed them.
  await syncLegacyProfileRole(profileId, roles);

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 14. Remove staff role
// ---------------------------------------------------------------------------
export async function removeStaffRole(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const profileId = formData.get("profileId") as string;
  const role = formData.get("role") as string;
  if (!profileId || !role) return { error: "Missing required fields" };

  // Same escalation gate as addStaffRole — revoking admin-tier access is as
  // sensitive as granting it (it can lock a colleague out of the studio).
  if ((ADMIN_TIER_ROLES as readonly string[]).includes(role)) {
    const { data: callerRole } = await supabase.from("profile_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").eq("is_active", true).maybeSingle();
    if (!callerRole) return { error: "Only Studio Owners can remove this role" };
  }
  if (profileId === user.id && role === "super_admin") return { error: "Cannot remove your own Studio Owner role" };

  // Last-owner protection. The self-removal check above stops an owner
  // demoting themselves, but not one owner removing another. A tenant with
  // zero active super_admins cannot grant the role back through any UI —
  // recovery requires direct SQL. Refuse instead.
  if (role === "super_admin") {
    const { data: target } = await supabase
      .from("profile_roles")
      .select("tenant_id, is_active")
      .eq("user_id", profileId)
      .eq("role", "super_admin")
      .maybeSingle();

    // Only a currently-active owner row can reduce the active owner count.
    if (target?.is_active) {
      let ownerQuery = supabase
        .from("profile_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")
        .eq("is_active", true);

      // Scope to the target's tenant when known; some legacy rows have none.
      if (target.tenant_id) ownerQuery = ownerQuery.eq("tenant_id", target.tenant_id);

      const { count, error: countErr } = await ownerQuery;

      // Fail closed — if the count cannot be established, do not risk the
      // removal being the last one.
      if (countErr) {
        console.error("[removeStaffRole] owner count failed:", countErr.message);
        return { error: "Could not verify remaining Studio Owners — role not removed." };
      }
      if ((count ?? 0) <= 1) {
        return { error: "Cannot remove the last Studio Owner. Assign another Studio Owner first." };
      }
    }
  }

  const { error } = await supabase.from("profile_roles").delete().eq("user_id", profileId).eq("role", role);
  if (error) return { error: error.message };

  // No fallback set — see syncLegacyProfileRole. If every active role is now
  // gone, legacyProfileRole([]) collapses to 'parent', which is the correct
  // floor: it is the least-privileged label the user_role enum offers, and the
  // person keeps no admin or teaching access from profile_roles either way.
  await syncLegacyProfileRole(profileId);

  revalidatePath("/admin/staff");
  return {};
}
