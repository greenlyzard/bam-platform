import { SignOutButton } from "@/components/layouts/sign-out-button";
import { PortalNav } from "@/components/layouts/portal-nav";
import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { getUser } from "@/lib/auth/guards";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-cream pb-16 sm:pb-0">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4 max-w-5xl mx-auto">
          <a href="/portal/dashboard" className="font-heading text-lg font-semibold text-charcoal">
            Ballet Academy and Movement
          </a>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:block text-sm text-slate">
                {user.firstName ?? user.email}
              </span>
            )}
            <SignOutButton />
            <div className="h-8 w-8 rounded-full bg-lavender-light flex items-center justify-center text-xs font-semibold text-lavender-dark">
              {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "?"}
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
  );
}
