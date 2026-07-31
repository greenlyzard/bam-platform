import { AdminNav } from "@/components/layouts/admin-nav";
import type { ModuleItem } from "@/components/layouts/admin-nav";
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
  const { role, full_name, avatar_url } = session.profile;

  const supabase = await createClient();
  const [{ data: settings }, { data: moduleRows }, { data: tenant }, { data: userRoles, error: userRolesError }] = await Promise.all([
    supabase.from("studio_settings").select("logo_url, logo_dark_url, studio_name").limit(1).single(),
    supabase
      .from("platform_modules")
      .select(
        "key, label, icon, href, nav_group, sort_order, platform_enabled, tenant_enabled, nav_visible, requires_role"
      )
      .order("sort_order"),
    supabase.from("tenants").select("angelina_enabled").eq("slug", "bam").single(),
    supabase.from("profile_roles").select("role").eq("user_id", session.user.id).eq("is_active", true),
  ]);
  const logoUrl = settings?.logo_dark_url ?? settings?.logo_url;
  const angelinaEnabled = tenant?.angelina_enabled ?? true;

  // This is a SECOND profile_roles read — requireRole() above resolved the
  // session's roles from its own query. Both must fail the same way, or fixing
  // the resolver alone changes nothing here.
  //
  // Every flag below was `?? false`, which silently collapsed a multi-role user
  // on any read failure: Amanda holds four roles, and a single failed query
  // dropped her Teacher Portal link (isTeacher) and her timesheets/payroll nav
  // (canManagePay) with no error anywhere. Losing a nav item is a quiet, wrong
  // answer to "what may this person do"; throw instead and let app/error.tsx
  // say so. Zero rows still means false — that is a real answer, not a failure.
  if (userRolesError) {
    console.error("[admin-layout] profile_roles read failed", {
      userId: session.user.id,
      code: userRolesError.code,
      message: userRolesError.message,
    });
    throw new Error(
      `Could not read profile_roles for ${session.user.id} (${userRolesError.code || "no code"}): ${userRolesError.message}`
    );
  }

  const isTeacher = userRoles.some((r) => r.role === "teacher");
  const isParent = userRoles.some((r) => r.role === "parent");
  const userEmail = session.user.email;

  // Mirrors can_manage_pay() in RLS (20260728000006) and requireFinance() in
  // lib/auth/guards. Computed from the profile_roles rows already fetched
  // above, so hiding the pay nav costs no extra query. Read from profile_roles,
  // never profiles.role — see CLAUDE.md §4.
  const canManagePay = userRoles.some(
    (r) => r.role === "finance_admin" || r.role === "super_admin"
  );

  const modules: ModuleItem[] = (moduleRows ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    icon: m.icon,
    href: m.href ?? "",
    nav_group: m.nav_group,
    sort_order: m.sort_order,
    platform_enabled: m.platform_enabled,
    tenant_enabled: m.tenant_enabled,
    nav_visible: m.nav_visible,
    requires_role: m.requires_role,
  }));

  return (
    <RoleProvider role={role} fullName={full_name}>
      <div className="min-h-screen bg-cream pb-16 lg:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-silver bg-white/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <a href="/admin/dashboard" className="flex items-center gap-2">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={settings?.studio_name ?? "Studio"}
                  className="h-8 w-auto object-contain"
                />
              )}
              <span className="font-semibold text-charcoal text-sm hidden sm:block">
                {settings?.studio_name ?? "Ballet Academy and Movement"}
              </span>
            </a>
            <div className="flex items-center gap-3">
              {isTeacher && (
                <a href="/teach/dashboard" className="text-xs px-3 py-1.5 border border-gray-200 rounded-full hover:bg-gray-50 text-mist hover:text-charcoal transition-colors">
                  Teacher Portal
                </a>
              )}
              {isParent && (
                <a href="/portal/dashboard" className="text-xs px-3 py-1.5 border border-gray-200 rounded-full hover:bg-gray-50 text-mist hover:text-charcoal transition-colors">
                  Parent Portal
                </a>
              )}
              <span className="hidden sm:block text-sm text-slate">
                {full_name ?? session.user.email}
              </span>
              <AvatarDropdown
                initial={full_name?.[0] ?? session.user.email[0]?.toUpperCase() ?? "?"}
                fullName={full_name ?? ""}
                email={session.user.email}
                avatarUrl={avatar_url}
              />
            </div>
          </div>
        </header>

        {/* Desktop: sidebar + content */}
        <div className="hidden lg:flex">
          <aside className="w-60 shrink-0 border-r border-silver bg-white min-h-[calc(100vh-3.5rem)] overflow-y-auto py-4 px-3">
            <AdminNav role={role} modules={modules} userEmail={userEmail} canManagePay={canManagePay} />
          </aside>
          <main className="flex-1 p-6 min-w-0">{children}</main>
        </div>

        {/* Mobile content */}
        <main className="lg:hidden px-4 py-6">{children}</main>

        {/* Bottom tab bar (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-silver bg-white lg:hidden">
          <AdminNav mobile role={role} modules={modules} userEmail={userEmail} canManagePay={canManagePay} />
        </nav>
        <AngelinaChat role="admin" mode="floating" enabled={angelinaEnabled} />
      </div>
    </RoleProvider>
  );
}
