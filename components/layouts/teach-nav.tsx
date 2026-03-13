"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { label: "My Dashboard", href: "/teach/dashboard", icon: "⌂" },
  { label: "Timesheets", href: "/teach/timesheets", icon: "▤" },
  { label: "Log Hours", href: "/teach/hours", icon: "◷" },
  { label: "My Schedule", href: "/teach/schedule", icon: "▥" },
  { label: "My Classes", href: "/teach/classes", icon: "▦" },
  { label: "My Students", href: "/teach/students", icon: "♡" },
  { label: "Report Absence", href: "/teach/report-absence", icon: "✕" },
  { label: "Chat (Angelina)", href: "/teach/chat", icon: "◈" },
];

const mobileItems = [
  { label: "Home", href: "/teach/dashboard", icon: "⌂" },
  { label: "Timesheet", href: "/teach/timesheets", icon: "▤" },
  { label: "Classes", href: "/teach/classes", icon: "▦" },
  { label: "Students", href: "/teach/students", icon: "♡" },
  { label: "More", href: "/teach/hours", icon: "⋯" },
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
