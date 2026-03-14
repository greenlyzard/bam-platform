import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth callback handler.
 * Handles two flows:
 *   1. PKCE code flow (OAuth, email signup) — exchanges `code` for session
 *   2. Magic link / OTP flow — verifies `token_hash` + `type` params
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const redirect = searchParams.get("redirect") ?? null;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookie set may fail
          }
        },
      },
    }
  );

  let authError: unknown = null;

  if (code) {
    // Flow 1: PKCE code exchange
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    // Flow 2: Magic link / OTP token verification
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "signup" | "recovery" | "email_change",
    });
    authError = error;
  } else {
    // Neither flow — no valid params
    return NextResponse.redirect(
      new URL("/login?error=missing_auth_params", origin)
    );
  }

  if (authError) {
    console.error("[auth:callback] Error:", authError);
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin)
    );
  }

  // If there's a redirect param, go there
  if (redirect) {
    return NextResponse.redirect(new URL(redirect, origin));
  }

  // Otherwise, route based on role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const roleHome: Record<string, string> = {
      super_admin: "/admin/dashboard",
      admin: "/admin/dashboard",
      studio_admin: "/admin/dashboard",
      finance_admin: "/admin/dashboard",
      studio_manager: "/admin/dashboard",
      front_desk: "/admin/dashboard",
      teacher: "/teach/dashboard",
      parent: "/portal/dashboard",
      student: "/portal/dashboard",
    };

    const home = roleHome[profile?.role ?? "parent"] ?? "/portal/dashboard";
    return NextResponse.redirect(new URL(home, origin));
  }

  // Session established but no user — shouldn't happen
  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", origin)
  );
}
