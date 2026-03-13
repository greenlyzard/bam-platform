"use client";

import { useState } from "react";
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

const mobileItems = [
  { label: "Home", href: "/admin/dashboard", icon: "⌂" },
  { label: "Classes", href: "/admin/classes", icon: "▦" },
  { label: "Teachers", href: "/admin/teachers", icon: "★" },
  { label: "Students", href: "/admin/students", icon: "♡" },
  { label: "More", href: "/admin/settings", icon: "⋯" },
];

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

  if (mobile) {
    return (
      <div className="flex h-14 items-center justify-around">
        {mobileItems.map((item) => {
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
      </div>
    );
  }

  // Build groups from modules
  const groupMap: Record<string, ModuleItem[]> = {};
  for (const mod of modules) {
    // Platform-level kill switch: completely hide
    if (!mod.platform_enabled) continue;

    // Settings platform page: only Derek
    if (mod.key === "settings_platform" && !isDerek) continue;

    // Check if module should be visible
    const isEnabled = mod.tenant_enabled && mod.nav_visible;
    if (!isEnabled && !isDerek) continue;

    if (!groupMap[mod.nav_group]) groupMap[mod.nav_group] = [];
    groupMap[mod.nav_group].push(mod);
  }

  // Sort groups by defined order, items by sort_order
  const groups: NavGroup[] = GROUP_ORDER
    .filter((g) => groupMap[g] && groupMap[g].length > 0)
    .map((g) => ({
      label: g,
      items: groupMap[g].sort((a, b) => a.sort_order - b.sort_order),
    }));

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
