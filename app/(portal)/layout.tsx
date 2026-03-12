import Image from "next/image";
import { SignOutButton } from "@/components/layouts/sign-out-button";
import { PortalNav } from "@/components/layouts/portal-nav";
import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { RoleProvider } from "@/context/RoleContext";
import { requireRole } from "@/lib/auth/requireRole";
import { getStudioSettings } from "@/lib/queries/studio-settings";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, settings] = await Promise.all([
    requireRole(["super_admin", "admin", "parent"]),
    getStudioSettings(),
  ]);
  const { role, full_name } = session.profile;
  const studioName = settings?.studio_name ?? "Ballet Academy & Movement";

  return (
    <RoleProvider role={role} fullName={full_name}>
      <div className="min-h-screen bg-cream pb-16 sm:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4 max-w-5xl mx-auto">
            <a href="/portal/dashboard" className="flex items-center gap-2.5">
              <Image
                src="/images/studio-logo.png"
                alt={studioName}
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="font-heading text-lg font-semibold text-charcoal">
                {studioName}
              </span>
            </a>
            <div className="flex items-center gap-3">
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
        <div className="hidden sm:flex max-w-5xl mx-auto">
          <aside className="w-48 shrink-0 py-6 pr-6">
            <PortalNav />
          </aside>
          <main className="flex-1 py-6 min-w-0">{children}</main>
        </div>

        {/* Mobile content */}
        <main className="sm:hidden px-4 py-6">{children}</main>

        {/* Bottom tab bar (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-silver bg-white sm:hidden">
          <PortalNav mobile />
        </nav>
        <AngelinaChat role="parent" mode="floating" />
      </div>
    </RoleProvider>
  );
}
