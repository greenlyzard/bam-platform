import { getSessionWithRole } from "@/lib/auth/getSessionWithRole";

const roleHome: Record<string, string> = {
  super_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  front_desk: "/admin/dashboard",
  teacher: "/teach/dashboard",
  parent: "/portal/dashboard",
  student: "/portal/dashboard",
};

export default async function UnauthorizedPage() {
  // This page is where proxy.ts sends a role-mismatched user, and
  // getSessionWithRole() now throws when it cannot read profile_roles. If that
  // throw were allowed to propagate here, the page whose whole job is to
  // explain the failure would itself become a 500 — the user would see nothing
  // but a blank error, on the one route guaranteed to be reachable.
  //
  // So the message renders unconditionally. The role read is used only to
  // pick a nicer destination; when it fails we send them to sign in again.
  let dashboardHref = "/login";
  try {
    const session = await getSessionWithRole();
    if (session) {
      dashboardHref = roleHome[session.profile.role] ?? "/portal/dashboard";
    }
  } catch (err) {
    console.error(
      "[unauthorized] role read failed, falling back to /login:",
      err instanceof Error ? err.message : err
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-3xl font-semibold text-charcoal mb-3">
          Access Denied
        </h1>
        <p className="text-slate mb-6">
          You don&apos;t have permission to view this page.
        </p>
        <a
          href={dashboardHref}
          className="inline-flex items-center gap-2 rounded-lg bg-lavender px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-lavender-dark"
        >
          {dashboardHref === "/login" ? "Sign in again" : "Go to your dashboard"}
        </a>
      </div>
    </div>
  );
}
