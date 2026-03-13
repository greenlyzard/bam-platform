import { AdminNav } from "@/components/layouts/admin-nav";
import { AvatarDropdown } from "@/components/layouts/avatar-dropdown";
import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { RoleProvider } from "@/context/RoleContext";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["super_admin", "admin"]);
  const { role, full_name } = session.profile;

  const supabase = await createClient();
  const [{ data: settings }, { data: flagRows }] = await Promise.all([
    supabase.from("studio_settings").select("logo_url").limit(1).single(),
    supabase.from("feature_flags").select("key, is_enabled"),
  ]);
  const logoUrl = settings?.logo_url;
  const featureFlags: Record<string, boolean> = {};
  for (const f of flagRows ?? []) {
    featureFlags[f.key] = f.is_enabled;
  }
  const userEmail = session.user.email;

  return (
    <RoleProvider role={role} fullName={full_name}>
      <div className="min-h-screen bg-cream pb-16 lg:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <a
              href="/admin/dashboard"
              className="flex items-center gap-2.5 font-heading text-lg font-semibold text-charcoal"
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Studio logo"
                  className="h-8 w-auto object-contain"
                />
              )}
              Studio Admin
            </a>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-slate">
                {full_name ?? session.user.email}
              </span>
              <AvatarDropdown
                initial={full_name?.[0] ?? session.user.email[0]?.toUpperCase() ?? "?"}
                fullName={full_name ?? ""}
                email={session.user.email}
              />
            </div>
          </div>
        </header>

        {/* Desktop: sidebar + content */}
        <div className="hidden lg:flex">
          <aside className="w-60 shrink-0 border-r border-silver bg-white min-h-[calc(100vh-3.5rem)] overflow-y-auto py-4 px-3">
            <AdminNav role={role} featureFlags={featureFlags} userEmail={userEmail} />
          </aside>
          <main className="flex-1 p-6 min-w-0">{children}</main>
        </div>

        {/* Mobile content */}
        <main className="lg:hidden px-4 py-6">{children}</main>

        {/* Bottom tab bar (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-silver bg-white lg:hidden">
          <AdminNav mobile role={role} featureFlags={featureFlags} userEmail={userEmail} />
        </nav>
        <AngelinaChat role="admin" mode="floating" />
      </div>
    </RoleProvider>
  );
}
