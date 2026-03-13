"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/getSessionWithRole";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  superAdminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "Studio",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: "⌂" },
      { label: "Seasons", href: "/admin/seasons", icon: "◈" },
      { label: "Schedule", href: "/admin/schedule", icon: "▥" },
      { label: "Schedule Classes", href: "/admin/schedule/classes", icon: "▦" },
      { label: "Tasks", href: "/admin/tasks", icon: "☑" },
      { label: "Calendar", href: "/admin/calendar", icon: "▥" },
      { label: "Schedule Embeds", href: "/admin/schedule-embeds", icon: "◫" },
      { label: "Classes", href: "/admin/classes", icon: "▦" },
      { label: "Students", href: "/admin/students", icon: "♡" },
      { label: "Families", href: "/admin/families", icon: "◇" },
    ],
  },
  {
    label: "Staff",
    items: [
      { label: "Teachers", href: "/admin/teachers", icon: "★" },
      { label: "Compliance", href: "/admin/compliance", icon: "◆" },
      { label: "Substitute Requests", href: "/admin/substitute-requests", icon: "↻" },
    ],
  },
  {
    label: "Productions",
    items: [
      { label: "Productions", href: "/admin/productions", icon: "♛" },
    ],
  },
  {
    label: "Communications",
    items: [
      { label: "Announcements", href: "/admin/communications", icon: "✉" },
      { label: "Email Templates", href: "/admin/emails", icon: "✧" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Billing", href: "/admin/billing", icon: "✦" },
      { label: "Reports", href: "/admin/reports", icon: "▲" },
    ],
  },
  {
    label: "Content",
    items: [{ label: "LMS Content", href: "/admin/content", icon: "▶" }],
  },
  {
    label: "AI",
    items: [
      { label: "Angelina Chat", href: "/admin/chat", icon: "◈" },
      { label: "Conversations", href: "/admin/angelina", icon: "◇" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Resources", href: "/admin/resources", icon: "◧" },
      { label: "Rentals", href: "/admin/resources/rentals", icon: "◨" },
      { label: "Expansion", href: "/admin/expansion", icon: "●" },
    ],
  },
  {
    label: "Settings",
    superAdminOnly: true,
    items: [
      { label: "Theme", href: "/admin/settings/theme", icon: "◑" },
      { label: "Team Members", href: "/admin/settings/team", icon: "◉" },
    ],
  },
];

const mobileItems: NavItem[] = [
  { label: "Home", href: "/admin/dashboard", icon: "⌂" },
  { label: "Classes", href: "/admin/classes", icon: "▦" },
  { label: "Teachers", href: "/admin/teachers", icon: "★" },
  { label: "Students", href: "/admin/students", icon: "♡" },
  { label: "More", href: "/admin/billing", icon: "⋯" },
];

export function AdminNav({
  mobile = false,
  role,
}: {
  mobile?: boolean;
  role?: Role;
}) {
  const pathname = usePathname();

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

  const visibleGroups = navGroups.filter(
    (group) => !group.superAdminOnly || role === "super_admin"
  );

  return (
    <nav className="space-y-4">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-mist">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-lavender/10 text-lavender-dark"
                      : "text-slate hover:bg-cloud hover:text-charcoal"
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
