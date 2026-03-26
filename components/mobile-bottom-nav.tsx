"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MobileBottomNavProps {
  variant: "portal" | "teacher";
}

const PORTAL_TABS = [
  { href: "/portal/dashboard", label: "Home", icon: "house" },
  { href: "/portal/settings/notifications", label: "Notifications", icon: "bell" },
  { href: "/portal/events", label: "Events", icon: "calendar" },
  { href: "/portal/messages", label: "Messages", icon: "chat" },
] as const;

const TEACHER_TABS = [
  { href: "/teach/dashboard", label: "Home", icon: "house" },
  { href: "/teach/settings/notifications", label: "Notifications", icon: "bell" },
  { href: "/teach/events", label: "Events", icon: "calendar" },
  { href: "/teach/messages", label: "Messages", icon: "chat" },
] as const;

function Icon({ name, className }: { name: string; className?: string }) {
  const cn = className ?? "h-5 w-5";
  switch (name) {
    case "house":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={cn}>
          <path d="M2.5 6.5L8 2l5.5 4.5V13a1 1 0 01-1 1h-3V10H6.5v4h-3a1 1 0 01-1-1V6.5z" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={cn}>
          <path d="M4 6a4 4 0 018 0c0 2.5 1 4 1.5 4.5H2.5C3 10 4 8.5 4 6zM6.5 12a1.5 1.5 0 003 0" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={cn}>
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 2v2M10.5 2v2" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={cn}>
          <path d="M2.5 3h11a1 1 0 011 1v7a1 1 0 01-1 1H5l-2.5 2V4a1 1 0 011-1z" />
          <circle cx="5.5" cy="7.5" r="0.5" fill="currentColor" />
          <circle cx="8" cy="7.5" r="0.5" fill="currentColor" />
          <circle cx="10.5" cy="7.5" r="0.5" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-error text-white text-[10px] font-semibold leading-none px-1">
      {display}
    </span>
  );
}

export function MobileBottomNav({ variant }: MobileBottomNavProps) {
  const pathname = usePathname();
  const tabs = variant === "portal" ? PORTAL_TABS : TEACHER_TABS;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function fetchCounts() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Unread notifications
      const { count: notifCount } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      setUnreadNotifications(notifCount ?? 0);

      // Unread messages (simplified — count unread notifications of message type)
      const { count: msgCount } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .in("type", ["channel_message", "direct_message"]);

      setUnreadMessages(msgCount ?? 0);
    }

    fetchCounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("mobile-nav-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function isActive(href: string) {
    if (href.endsWith("/dashboard")) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  function getBadge(icon: string) {
    if (icon === "bell") return unreadNotifications;
    if (icon === "chat") return unreadMessages;
    return 0;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-silver/30 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const badge = getBadge(tab.icon);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-lavender" : "text-mist"
              }`}
            >
              <span className="relative">
                <Icon name={tab.icon} />
                <Badge count={badge} />
              </span>
              <span className="text-[10px] font-medium leading-tight">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
