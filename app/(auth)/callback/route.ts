import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth callback handler.
 * Handles three flows:
 *   1. PKCE code flow (OAuth, email signup) — exchanges `code` for session
 *   2. Magic link / OTP flow — verifies `token_hash` + `type` params
 *   3. pkce_-prefixed token_hash — tries verifyOtp then exchangeCodeForSession
 *
 * Uses response-based cookie pattern (not next/headers cookies()) so that
 * session cookies are correctly set on the redirect response.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const redirectParam = searchParams.get("redirect") ?? null;

  // Pre-build a redirect response — cookies will be set on this object.
  // The destination URL will be updated before returning.
  const redirectUrl = new URL("/portal/dashboard", origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let authError: unknown = null;

  if (code) {
    // Flow 1: PKCE code exchange (OAuth, email signup)
    console.log("[auth:callback] Attempting exchangeCodeForSession with code");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    // Flow 2: token_hash verification
    const otpType = type as "magiclink" | "email" | "signup" | "recovery" | "email_change";
    const stripped = tokenHash.startsWith("pkce_") ? tokenHash.slice(5) : null;

    console.log(`[auth:callback] token_hash received, type=${type}, pkce_prefix=${!!stripped}`);

    // Strategy A: verifyOtp with the full token_hash as-is
    console.log("[auth:callback] Strategy A: verifyOtp full hash, type:", otpType);
    const attemptA = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (!attemptA.error) {
      console.log("[auth:callback] Strategy A succeeded");
      authError = null;
    } else {
      console.warn("[auth:callback] Strategy A failed:", attemptA.error.message);

      // Strategy B: try alternate type (email ↔ magiclink)
      const altType = otpType === "magiclink" ? "email" : otpType === "email" ? "magiclink" : null;
      let resolved = false;

      if (altType) {
        console.log("[auth:callback] Strategy B: verifyOtp full hash, alt type:", altType);
        const attemptB = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: altType,
        });
        if (!attemptB.error) {
          console.log("[auth:callback] Strategy B succeeded");
          resolved = true;
        } else {
          console.warn("[auth:callback] Strategy B failed:", attemptB.error.message);
        }
      }

      if (!resolved && stripped) {
        // Strategy C: strip pkce_ prefix and retry verifyOtp
        console.log("[auth:callback] Strategy C: verifyOtp stripped hash");
        const attemptC = await supabase.auth.verifyOtp({
          token_hash: stripped,
          type: otpType,
        });
        if (!attemptC.error) {
          console.log("[auth:callback] Strategy C succeeded");
          resolved = true;
        } else {
          console.warn("[auth:callback] Strategy C failed:", attemptC.error.message);
        }
      }

      if (!resolved) {
        // Strategy D: exchangeCodeForSession with full token_hash
        console.log("[auth:callback] Strategy D: exchangeCodeForSession full hash");
        const attemptD = await supabase.auth.exchangeCodeForSession(tokenHash);
        if (!attemptD.error) {
          console.log("[auth:callback] Strategy D succeeded");
          resolved = true;
        } else {
          console.warn("[auth:callback] Strategy D failed:", attemptD.error.message);
        }
      }

      if (!resolved && stripped) {
        // Strategy E: exchangeCodeForSession with stripped hash
        console.log("[auth:callback] Strategy E: exchangeCodeForSession stripped hash");
        const attemptE = await supabase.auth.exchangeCodeForSession(stripped);
        if (!attemptE.error) {
          console.log("[auth:callback] Strategy E succeeded");
          resolved = true;
        } else {
          console.warn("[auth:callback] Strategy E failed:", attemptE.error.message);
        }
      }

      if (!resolved) {
        authError = { message: "All verification strategies failed" };
        console.error("[auth:callback] All strategies exhausted");
      }
    }
  } else {
    // Neither flow — no valid params
    return NextResponse.redirect(
      new URL("/login?error=missing_auth_params", origin)
    );
  }

  if (authError) {
    console.error("[auth:callback] Final error:", authError);
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin)
    );
  }

  // If there's a redirect param, go there
  if (redirectParam) {
    response.headers.set("Location", new URL(redirectParam, origin).toString());
    return response;
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
    response.headers.set("Location", new URL(home, origin).toString());
    return response;
  }

  // Session established but no user — shouldn't happen
  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", origin)
  );
}
