"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/getSessionWithRole";

export interface ModuleItem {
  key: string;
  label: string;
  icon: string;
  href: string;
  nav_group: string;
  sort_order: number;
  platform_enabled: boolean;
  tenant_enabled: boolean;
  nav_visible: boolean;
  requires_role?: string | null;
}

interface NavGroup {
  label: string;
  items: ModuleItem[];
}

const SUPER_EMAIL = "derek@greenlyzard.com";

const GROUP_ORDER = [
  "Studio",
  "Students & Families",
  "Staff",
  "Productions",
  "Communications",
  "Settings",
];

/** Bottom tab items — "More" is handled specially */
const mobileTabItems = [
  { label: "Home", href: "/admin/dashboard", icon: "⌂" },
  { label: "Timesheets", href: "/admin/timesheets", icon: "▤" },
  { label: "Comms", href: "/admin/communications", icon: "✉" },
  { label: "Students", href: "/admin/students", icon: "♡" },
];

function buildNavGroups(modules: ModuleItem[], isDerek: boolean): NavGroup[] {
  const groupMap: Record<string, ModuleItem[]> = {};
  for (const mod of modules) {
    if (!mod.platform_enabled) continue;
    if (mod.key === "settings_platform" && !isDerek) continue;
    const isEnabled = mod.tenant_enabled && mod.nav_visible;
    if (!isEnabled && !isDerek) continue;
    if (!groupMap[mod.nav_group]) groupMap[mod.nav_group] = [];
    groupMap[mod.nav_group].push(mod);
  }
  return GROUP_ORDER
    .filter((g) => groupMap[g] && groupMap[g].length > 0)
    .map((g) => ({
      label: g,
      items: groupMap[g].sort((a, b) => a.sort_order - b.sort_order),
    }));
}

export function AdminNav({
  mobile = false,
  role,
  modules = [],
  userEmail,
}: {
  mobile?: boolean;
  role?: Role;
  modules?: ModuleItem[];
  userEmail?: string;
}) {
  const pathname = usePathname();
  const isDerek = userEmail === SUPER_EMAIL;
  const [moreOpen, setMoreOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (mobile) {
    const groups = buildNavGroups(modules, isDerek);

    return (
      <>
        <div className="flex h-14 items-center justify-around">
          {mobileTabItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 text-xs min-w-[3rem] ${
                  active ? "text-lavender font-semibold" : "text-slate"
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 text-xs min-w-[3rem] text-slate"
          >
            <span className="text-lg leading-none">⋯</span>
            More
          </button>
        </div>

        {/* More drawer overlay */}
        {moreOpen && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMoreOpen(false)}
            />
            {/* Drawer */}
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-2xl shadow-2xl overflow-y-auto animate-in slide-in-from-bottom duration-200">
              {/* Handle + close */}
              <div className="sticky top-0 bg-white rounded-t-2xl border-b border-silver px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-heading font-semibold text-charcoal">
                  Navigation
                </span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="h-8 w-8 rounded-full text-slate hover:bg-cloud flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-4 py-3 pb-8 space-y-4">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-mist mb-1 px-1">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = pathname.startsWith(item.href);
                        const isDisabled = !item.tenant_enabled || !item.nav_visible;
                        return (
                          <a
                            key={item.key}
                            href={item.href}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                              active
                                ? "bg-lavender/10 text-lavender-dark"
                                : "text-slate hover:bg-cloud hover:text-charcoal"
                            } ${isDisabled ? "opacity-50" : ""}`}
                          >
                            <span className="text-base leading-none">{item.icon}</span>
                            {item.label}
                            {isDisabled && isDerek && (
                              <span className="ml-auto text-xs">🔒</span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const groups = buildNavGroups(modules, isDerek);

  return (
    <nav className="space-y-1">
      {groups.map((group) => (
        <NavGroupSection
          key={group.label}
          group={group}
          pathname={pathname}
          isDerek={isDerek}
        />
      ))}
    </nav>
  );
}

function NavGroupSection({
  group,
  pathname,
  isDerek,
}: {
  group: NavGroup;
  pathname: string;
  isDerek: boolean;
}) {
  const hasActiveItem = group.items.some((item) =>
    pathname.startsWith(item.href)
  );
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="pt-3 first:pt-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 pb-1 group"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-mist">
          {group.label}
        </span>
        <svg
          className={`w-3 h-3 text-mist transition-transform ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5">
          {group.items.map((item) => {
            const active = pathname.startsWith(item.href);
            const isDisabled =
              !item.tenant_enabled || !item.nav_visible;

            return (
              <a
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-lavender/10 text-lavender-dark"
                    : "text-slate hover:bg-cloud hover:text-charcoal"
                } ${isDisabled ? "opacity-50" : ""}`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
                {isDisabled && isDerek && (
                  <span className="ml-auto text-xs">🔒</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
