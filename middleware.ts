import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase session-refresh middleware (@supabase/ssr).
 *
 * Runs on each matched request, calls `supabase.auth.getUser()` to refresh the rotating
 * access/refresh tokens, and writes the refreshed `sb-*` cookies onto the response. Server
 * Components cannot set cookies (see the swallowed `setAll` in `lib/supabase/server.ts`), so
 * without this middleware the tokens never persist: once the access token expires, `getUser()`
 * returns null and RLS queries send an expired JWT — the /admin/classes login-redirect +
 * `getAllClasses` empty-`{}` bug.
 */
export async function middleware(request: NextRequest) {
  // Defense-in-depth: never touch machine-to-machine routes (Stripe webhook, cron). These are
  // also excluded by `matcher` below — guard here too so a matcher edit can't silently expose
  // them to session/cookie mutation.
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/cron") || pathname === "/api/enrollment/webhook") {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser(). getUser() performs the
  // token refresh and triggers setAll(), which persists the rotated cookies onto supabaseResponse.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static, _next/image  (build output)
     * - favicon.ico                (favicon)
     * - static asset files         (images / fonts served from /public)
     * - /api/cron/*                (cron jobs — must not be session-touched)
     * - /api/enrollment/webhook    (Stripe posts here — must not be session-touched)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/cron|api/enrollment/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)",
  ],
};
