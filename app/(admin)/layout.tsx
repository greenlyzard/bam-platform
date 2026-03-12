import { SignOutButton } from "@/components/layouts/sign-out-button";
import { AdminNav } from "@/components/layouts/admin-nav";
import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { getUser } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-cream pb-16 lg:pb-0">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <a
            href="/admin/dashboard"
            className="font-heading text-lg font-semibold text-charcoal"
          >
            Studio Admin
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

      {/* Desktop: sidebar + content */}
      <div className="hidden lg:flex">
        <aside className="w-60 shrink-0 border-r border-silver bg-white min-h-[calc(100vh-3.5rem)] overflow-y-auto py-4 px-3">
          <AdminNav />
        </aside>
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>

      {/* Mobile content */}
      <main className="lg:hidden px-4 py-6">{children}</main>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-silver bg-white lg:hidden">
        <AdminNav mobile />
      </nav>
      <AngelinaChat role="admin" mode="floating" />
    </div>
  );
}
