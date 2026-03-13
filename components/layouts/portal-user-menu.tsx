"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "@/lib/auth/actions";

interface PortalUserMenuProps {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

export function PortalUserMenu({
  fullName,
  email,
  avatarUrl,
}: PortalUserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials =
    fullName
      ? fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : email[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-full overflow-hidden bg-lavender-light flex items-center justify-center hover:ring-2 hover:ring-lavender transition-all shrink-0"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-semibold text-lavender-dark">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-silver bg-white shadow-lg py-1 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-silver/50">
            <p className="text-sm font-medium text-charcoal truncate">
              {fullName ?? "Account"}
            </p>
            <p className="text-xs text-mist truncate">{email}</p>
          </div>

          {/* Menu items */}
          <a
            href="/portal/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate hover:bg-cloud hover:text-charcoal transition-colors"
          >
            <span className="text-base leading-none">◎</span>
            Account Settings
          </a>

          <div className="border-t border-silver/50">
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate hover:bg-cloud hover:text-charcoal transition-colors text-left"
              >
                <span className="text-base leading-none">↗</span>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
