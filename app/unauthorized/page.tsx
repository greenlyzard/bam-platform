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
  const session = await getSessionWithRole();
  const dashboardHref = session
    ? roleHome[session.profile.role] ?? "/portal/dashboard"
    : "/login";

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
          Go to your dashboard
        </a>
      </div>
    </div>
  );
}
