import { SignOutButton } from "@/components/layouts/sign-out-button";
import { TeachNav } from "@/components/layouts/teach-nav";
import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { RoleProvider } from "@/context/RoleContext";
import { requireRole } from "@/lib/auth/requireRole";

export default async function TeachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["super_admin", "admin", "teacher"]);
  const { role, full_name } = session.profile;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <RoleProvider role={role} fullName={full_name}>
      <div className="min-h-screen bg-cream pb-16 sm:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4 max-w-6xl mx-auto">
            <a
              href="/teach/dashboard"
              className="font-heading text-lg font-semibold text-charcoal"
            >
              Teacher Portal
            </a>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-slate">{today}</span>
              <span className="hidden sm:block text-sm text-slate">
                {full_name ?? session.user.email}
              </span>
              <SignOutButton />
              <div className="h-8 w-8 rounded-full bg-lavender-light flex items-center justify-center text-xs font-semibold text-lavender-dark">
                {full_name?.[0] ?? session.user.email[0]?.toUpperCase() ?? "?"}
              </div>
            </div>
          </div>
        </header>

        {/* Desktop sidebar nav */}
        <div className="hidden sm:flex max-w-6xl mx-auto">
          <aside className="w-52 shrink-0 py-6 pr-6">
            <TeachNav />
          </aside>
          <main className="flex-1 py-6 min-w-0">{children}</main>
        </div>

        {/* Mobile content */}
        <main className="sm:hidden px-4 py-6">{children}</main>

        {/* Bottom tab bar (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-silver bg-white sm:hidden">
          <TeachNav mobile />
        </nav>
        <AngelinaChat role="teacher" mode="floating" />
      </div>
    </RoleProvider>
  );
}
