"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { label: "My Dashboard", href: "/portal/dashboard", icon: "⌂" },
  { label: "My Students", href: "/portal/students", icon: "♡" },
  { label: "Schedule", href: "/portal/schedule", icon: "▦" },
  { label: "Enrollment", href: "/portal/enrollment", icon: "◈" },
  { label: "Rehearsals", href: "/portal/rehearsals", icon: "♪" },
  { label: "Privates", href: "/portal/privates", icon: "◆" },
  { label: "Billing", href: "/portal/billing", icon: "✦" },
  { label: "Chat (Angelina)", href: "/portal/chat", icon: "◇" },
  { label: "Settings", href: "/portal/settings", icon: "◎" },
];

const mobileItems = [
  { label: "Home", href: "/portal/dashboard", icon: "⌂" },
  { label: "Students", href: "/portal/students", icon: "♡" },
  { label: "Schedule", href: "/portal/schedule", icon: "▦" },
  { label: "Billing", href: "/portal/billing", icon: "✦" },
  { label: "More", href: "/portal/enrollment", icon: "⋯" },
];

export function PortalNav({ mobile = false }: { mobile?: boolean }) {
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
