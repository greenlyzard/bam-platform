import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth callback handler.
 * Supabase redirects here after magic link click or OAuth consent.
 * Exchanges the auth code for a session, then redirects to the
 * appropriate dashboard based on user role.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? null;

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
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
    }
  }

  // Fallback — something went wrong
  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}
