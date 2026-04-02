import type { Metadata } from "next";
import { PortalNav } from "@/components/layouts/portal-nav";
import { PortalUserMenu } from "@/components/layouts/portal-user-menu";
import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { RoleProvider } from "@/context/RoleContext";
import { requireRole } from "@/lib/auth/requireRole";
import { getStudioSettings } from "@/lib/queries/studio-settings";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("studio_settings")
    .select("favicon_url, studio_name")
    .single();

  return {
    title: data?.studio_name ?? "Ballet Academy and Movement",
    icons: data?.favicon_url
      ? { icon: data.favicon_url, shortcut: data.favicon_url }
      : undefined,
  };
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, settings] = await Promise.all([
    requireRole(["super_admin", "admin", "parent", "teacher"]),
    getStudioSettings(),
  ]);
  const { role, full_name, avatar_url } = session.profile;
  const studioName = settings?.studio_name ?? "Ballet Academy & Movement";

  const supabase = await createClient();
  const portalAdmin = createAdminClient();
  const [{ data: tenant }, { data: adminRole }] = await Promise.all([
    supabase.from("tenants").select("angelina_enabled").eq("slug", "bam").single(),
    portalAdmin.from("profile_roles").select("id").eq("user_id", session.user.id).in("role", ["super_admin", "admin"]).eq("is_active", true).limit(1).maybeSingle(),
  ]);
  const angelinaEnabled = tenant?.angelina_enabled ?? true;

  return (
    <RoleProvider role={role} fullName={full_name}>
      <div className="min-h-screen bg-cream pb-16 sm:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4 max-w-5xl mx-auto">
            <a href="/portal/dashboard" className="flex items-center gap-2">
              {(settings?.logo_dark_url || settings?.logo_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logo_dark_url ?? settings.logo_url}
                  alt={studioName}
                  className="h-8 w-auto object-contain"
                />
              )}
              <span className="font-semibold text-charcoal text-sm hidden sm:block">
                {studioName}
              </span>
            </a>
            <div className="flex items-center gap-3">
              {adminRole && (
                <a
                  href="/admin/dashboard"
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-full hover:bg-gray-50 text-mist hover:text-charcoal transition-colors"
                >
                  &larr; Admin
                </a>
              )}
              <span className="hidden sm:block text-sm text-slate">
                {full_name ?? session.user.email}
              </span>
              <PortalUserMenu
                fullName={full_name}
                email={session.user.email}
                avatarUrl={avatar_url}
              />
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
        <MobileBottomNav variant="portal" />
        <AngelinaChat role="parent" mode="floating" enabled={angelinaEnabled} />
      </div>
    </RoleProvider>
  );
}
