"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

/**
 * Update profile fields (name, phone).
 */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = profileSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[settings:updateProfile]", error);
    return { error: "Failed to update profile" };
  }

  revalidatePath("/portal/settings");
  revalidatePath("/portal/dashboard");
  return { success: true };
}

/**
 * Change email address (triggers re-verification via Supabase).
 */
export async function changeEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const email = (formData.get("email") as string)?.trim();
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: "Valid email address is required" };
  }

  if (email === user.email) {
    return { error: "This is already your email address" };
  }

  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    console.error("[settings:changeEmail]", error);
    return { error: error.message };
  }

  // Also update profile table
  await supabase.from("profiles").update({ email }).eq("id", user.id);

  return {
    success: true,
    message: "Check your new email for a verification link.",
  };
}

/**
 * Set or change password. Works for magic-link users setting a password
 * for the first time, or existing password users changing theirs.
 */
export async function setPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("[settings:setPassword]", error);
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Upload avatar image. Expects a File from FormData.
 */
export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  // Validate file
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Only JPEG, PNG, and WebP images are allowed" };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `avatars/${user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("[settings:uploadAvatar]", uploadError);
    return { error: "Failed to upload image" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  // Add cache-busting timestamp
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) {
    console.error("[settings:uploadAvatar:profile]", profileError);
    return { error: "Image uploaded but profile update failed" };
  }

  revalidatePath("/portal/settings");
  revalidatePath("/portal/dashboard");
  return { success: true, avatar_url: avatarUrl };
}
