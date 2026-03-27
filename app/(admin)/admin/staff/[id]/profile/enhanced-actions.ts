"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 1. Update enhanced bio fields on profiles
// ---------------------------------------------------------------------------
export async function updateEnhancedBio(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  // Get the public URL
  const { data: urlData } = supabase.storage
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
      await supabase.storage.from("avatars").remove([storagePath]);
    }
  }

  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 11. Reorder photos
// ---------------------------------------------------------------------------
export async function reorderPhotos(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
// 13. Add staff role
// ---------------------------------------------------------------------------
export async function addStaffRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const profileId = formData.get("profileId") as string;
  const role = formData.get("role") as string;
  const tenantId = formData.get("tenantId") as string;
  if (!profileId || !role || !tenantId) return { error: "Missing required fields" };

  if (["admin", "finance_admin", "super_admin"].includes(role)) {
    const { data: callerRole } = await supabase.from("profile_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").eq("is_active", true).maybeSingle();
    if (!callerRole) return { error: "Only Studio Owners can assign this role" };
  }

  const { error } = await supabase.from("profile_roles").insert({ user_id: profileId, role, tenant_id: tenantId, is_active: true });
  if (error) { if (error.code === "23505") return { error: "Role already assigned" }; return { error: error.message }; }
  revalidatePath("/admin/staff");
  return {};
}

// ---------------------------------------------------------------------------
// 14. Remove staff role
// ---------------------------------------------------------------------------
export async function removeStaffRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const profileId = formData.get("profileId") as string;
  const role = formData.get("role") as string;
  if (!profileId || !role) return { error: "Missing required fields" };

  if (["admin", "finance_admin", "super_admin"].includes(role)) {
    const { data: callerRole } = await supabase.from("profile_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").eq("is_active", true).maybeSingle();
    if (!callerRole) return { error: "Only Studio Owners can remove this role" };
  }
  if (profileId === user.id && role === "super_admin") return { error: "Cannot remove your own Studio Owner role" };

  const { error } = await supabase.from("profile_roles").delete().eq("user_id", profileId).eq("role", role);
  if (error) return { error: error.message };
  revalidatePath("/admin/staff");
  return {};
}
