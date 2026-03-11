"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

/**
 * Sign in with magic link (email only, no password).
 * Primary auth method for parents — lowest friction.
 */
export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) return { error: "Email is required" };

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const redirectTo = formData.get("redirect") as string | null;
  const callbackUrl = redirectTo
    ? `${origin}/callback?redirect=${encodeURIComponent(redirectTo)}`
    : `${origin}/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error("[auth:magic_link]", error.message);
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Sign in with email and password.
 * Used by teachers and admins who log in frequently.
 */
export async function signInWithPassword(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[auth:password]", error.message);
    return { error: "Invalid email or password" };
  }

  // Fetch role to determine redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication failed" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const roleHome: Record<string, string> = {
    super_admin: "/admin/dashboard",
    admin: "/admin/dashboard",
    teacher: "/teach/dashboard",
    parent: "/portal/dashboard",
    student: "/portal/dashboard",
  };

  const home = roleHome[profile?.role ?? "parent"] ?? "/portal/dashboard";
  redirect(home);
}

/**
 * Sign up with email and password.
 */
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/callback`,
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "parent", // Default role — admin promotes manually
      },
    },
  });

  if (error) {
    console.error("[auth:signup]", error.message);
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Sign in with Google OAuth.
 */
export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const redirectTo = formData?.get("redirect") as string | null;
  const callbackUrl = redirectTo
    ? `${origin}/callback?redirect=${encodeURIComponent(redirectTo)}`
    : `${origin}/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error("[auth:google]", error.message);
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Sign out and redirect to login.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
