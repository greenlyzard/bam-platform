"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/getSessionWithRole";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  featureFlag?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  superAdminOnly?: boolean;
  featureFlag?: string;
}

const SUPER_EMAIL = "derek@greenlyzard.com";

const navGroups: NavGroup[] = [
  {
    label: "Studio",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: "⌂" },
      { label: "Seasons", href: "/admin/seasons", icon: "◈", featureFlag: "seasons" },
      { label: "Schedule", href: "/admin/schedule", icon: "▥" },
      { label: "Schedule Classes", href: "/admin/schedule/classes", icon: "▦", featureFlag: "schedule_classes" },
      { label: "Tasks", href: "/admin/tasks", icon: "☑", featureFlag: "tasks" },
      { label: "Calendar", href: "/admin/calendar", icon: "▥", featureFlag: "calendar" },
      { label: "Schedule Embeds", href: "/admin/schedule-embeds", icon: "◫", featureFlag: "schedule_embeds" },
      { label: "Classes", href: "/admin/classes", icon: "▦" },
      { label: "Students", href: "/admin/students", icon: "♡" },
      { label: "Families", href: "/admin/families", icon: "◇" },
    ],
  },
  {
    label: "Staff",
    items: [
      { label: "Teachers", href: "/admin/teachers", icon: "★" },
      { label: "Timesheets", href: "/admin/timesheets", icon: "▤" },
      { label: "Compliance", href: "/admin/compliance", icon: "◆", featureFlag: "compliance" },
      { label: "Substitute Requests", href: "/admin/substitute-requests", icon: "↻", featureFlag: "substitute_requests" },
    ],
  },
  {
    label: "Productions",
    featureFlag: "productions",
    items: [
      { label: "Productions", href: "/admin/productions", icon: "♛" },
      { label: "Rehearsals", href: "/admin/rehearsals", icon: "♪" },
    ],
  },
  {
    label: "Communications",
    items: [
      { label: "Announcements", href: "/admin/communications", icon: "✉", featureFlag: "announcements" },
      { label: "Email Templates", href: "/admin/emails", icon: "✧", featureFlag: "email_templates" },
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
      { label: "Knowledge Base", href: "/admin/knowledge-base", icon: "◆" },
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
      { label: "Pay Rates", href: "/admin/settings/pay-rates", icon: "◈" },
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
  featureFlags = {},
  userEmail,
}: {
  mobile?: boolean;
  role?: Role;
  featureFlags?: Record<string, boolean>;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const isDerek = userEmail === SUPER_EMAIL;

  function isItemVisible(flag?: string): "visible" | "disabled" | "hidden" {
    if (!flag) return "visible";
    if (featureFlags[flag] !== false) return "visible";
    // Flag is disabled
    if (isDerek) return "disabled";
    return "hidden";
  }

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
      {visibleGroups.map((group) => {
        // Check group-level flag
        const groupVis = isItemVisible(group.featureFlag);
        if (groupVis === "hidden") return null;

        // Filter items by flags
        const visibleItems = group.items.filter(
          (item) => isItemVisible(item.featureFlag) !== "hidden"
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label}>
            <p
              className={`px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-mist ${
                groupVis === "disabled" ? "opacity-50" : ""
              }`}
            >
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((item) => {
                const active = pathname.startsWith(item.href);
                const itemVis = isItemVisible(item.featureFlag);
                const isDisabled = groupVis === "disabled" || itemVis === "disabled";

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-lavender/10 text-lavender-dark"
                        : "text-slate hover:bg-cloud hover:text-charcoal"
                    } ${isDisabled ? "opacity-50" : ""}`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                    {isDisabled && (
                      <span className="ml-auto text-xs">🔒</span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
