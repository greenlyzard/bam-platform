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
      auth: {
        flowType: "implicit",
      },
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
    // Flow 1: PKCE code exchange (OAuth, email signup)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    // Flow 2: token_hash verification
    // Supabase may generate pkce_-prefixed hashes even for OTP.
    // Try multiple strategies to verify the token.
    const otpType = type as "magiclink" | "email" | "signup" | "recovery" | "email_change";
    const stripped = tokenHash.startsWith("pkce_") ? tokenHash.slice(5) : null;

    // Strategy A: verifyOtp with the full token_hash as-is
    const attemptA = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (!attemptA.error) {
      authError = null;
    } else {
      console.warn("[auth:callback] Attempt A failed:", attemptA.error.message);

      // Strategy B: try type 'email' if original was 'magiclink' (or vice versa)
      const altType = otpType === "magiclink" ? "email" : otpType === "email" ? "magiclink" : null;
      let attemptBOk = false;
      if (altType) {
        const attemptB = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: altType,
        });
        if (!attemptB.error) {
          attemptBOk = true;
        } else {
          console.warn("[auth:callback] Attempt B failed:", attemptB.error.message);
        }
      }

      if (!attemptBOk) {
        // Strategy C: strip pkce_ prefix and retry verifyOtp
        if (stripped) {
          const attemptC = await supabase.auth.verifyOtp({
            token_hash: stripped,
            type: otpType,
          });
          if (!attemptC.error) {
            // success
          } else {
            console.warn("[auth:callback] Attempt C failed:", attemptC.error.message);

            // Strategy D: try exchangeCodeForSession with the full token_hash
            const attemptD = await supabase.auth.exchangeCodeForSession(tokenHash);
            if (!attemptD.error) {
              // success
            } else {
              console.warn("[auth:callback] Attempt D failed:", attemptD.error.message);

              // Strategy E: exchangeCodeForSession with stripped value
              const attemptE = await supabase.auth.exchangeCodeForSession(stripped);
              authError = attemptE.error;
              if (attemptE.error) {
                console.error("[auth:callback] All strategies failed for pkce_ token");
              }
            }
          }
        } else {
          // No pkce_ prefix — original verifyOtp failed, try exchangeCodeForSession
          const attemptD = await supabase.auth.exchangeCodeForSession(tokenHash);
          authError = attemptD.error;
          if (attemptD.error) {
            console.error("[auth:callback] All strategies failed:", attemptD.error.message);
          }
        }
      }
    }
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
