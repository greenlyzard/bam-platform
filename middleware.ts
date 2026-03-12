import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/portal", "/teach", "/admin", "/learn"];

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

const PUBLIC_ROUTES = ["/auth/teacher-signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return await updateSession(request);
  }

  // Check if route is protected
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Update session and get response + user
  const { response, user } = await updateSession(request);

  // Redirect authenticated users away from /login and /signup
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const role = (user.user_metadata?.role as string) || "parent";
    const home = ROLE_HOME[role] || "/portal/dashboard";
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Redirect unauthenticated users to /login for protected routes
  if (!user && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce role-based route access for authenticated users on protected routes
  if (user && isProtected) {
    const role = (user.user_metadata?.role as string) || "parent";
    const allowedPrefixes = ROLE_ROUTES[role] || [];
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
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
