import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/portal", "/teach", "/admin", "/learn"];

// Public routes that should never be intercepted by auth middleware
const PUBLIC_PATHS = ["/callback", "/login", "/signup", "/forgot-password", "/reset-password"];

// Role → allowed route prefixes
const ROLE_ROUTES: Record<string, string[]> = {
  parent: ["/portal", "/learn", "/shop"],
  student: ["/portal", "/learn", "/shop"],
  teacher: ["/teach", "/portal", "/learn", "/shop"],
  front_desk: ["/admin", "/portal", "/learn", "/shop"],
  studio_manager: ["/admin", "/portal", "/learn", "/shop"],
  finance_admin: ["/admin", "/portal", "/learn", "/shop"],
  studio_admin: ["/admin", "/teach", "/portal", "/learn", "/shop"],
  admin: ["/admin", "/teach", "/portal", "/learn", "/shop"],
  super_admin: ["/admin", "/teach", "/portal", "/learn", "/shop"],
};

// Role → default redirect after login
const ROLE_HOME: Record<string, string> = {
  parent: "/portal/dashboard",
  student: "/portal/dashboard",
  teacher: "/teach/dashboard",
  front_desk: "/admin/dashboard",
  studio_manager: "/admin/dashboard",
  finance_admin: "/admin/dashboard",
  studio_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for public paths (callback, login, signup, etc.)
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Create Supabase client with cookie handling
  const response = NextResponse.next({ request });

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
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session (important — keeps session alive)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if route requires auth
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Redirect unauthenticated users to login
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "parent";
    const allowedPrefixes = ROLE_ROUTES[role] ?? ["/portal"];

    const hasAccess = allowedPrefixes.some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (!hasAccess) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     * - API routes (handled by their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
