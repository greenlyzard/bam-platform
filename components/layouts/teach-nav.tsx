"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/teach/dashboard", icon: "⌂" },
  { label: "My Classes", href: "/teach/classes", icon: "▦" },
  { label: "Attendance", href: "/teach/attendance", icon: "●" },
  { label: "Badges", href: "/teach/badges", icon: "◆" },
  { label: "Assessments", href: "/teach/assessments", icon: "▲" },
  { label: "Hours", href: "/teach/hours", icon: "◷" },
  { label: "Report Absence", href: "/teach/report-absence", icon: "✕" },
  { label: "Sub Requests", href: "/teach/substitute-requests", icon: "↻" },
  { label: "Content", href: "/teach/content", icon: "▶" },
  { label: "Messages", href: "/teach/messages", icon: "✉" },
  { label: "Ask Angelina", href: "/teach/chat", icon: "◈" },
];

const mobileItems = [
  { label: "Home", href: "/teach/dashboard", icon: "⌂" },
  { label: "Classes", href: "/teach/classes", icon: "▦" },
  { label: "Attend", href: "/teach/attendance", icon: "●" },
  { label: "Hours", href: "/teach/hours", icon: "◷" },
  { label: "More", href: "/teach/badges", icon: "⋯" },
];

export function TeachNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const items = mobile ? mobileItems : navItems;

  if (mobile) {
    return (
      <div className="flex h-14 items-center justify-around">
        {items.map((item) => {
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

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
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
    </nav>
  );
}
