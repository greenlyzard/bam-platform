"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "@/lib/auth/actions";

export function AvatarDropdown({
  initial,
  fullName,
  email,
  avatarUrl,
  profileHref = "/admin/settings/profile",
}: {
  initial: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  profileHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-full bg-lavender-light flex items-center justify-center text-xs font-semibold text-lavender-dark hover:ring-2 hover:ring-lavender/30 transition-all overflow-hidden"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-silver bg-white shadow-lg py-1 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-silver">
            <p className="text-sm font-medium text-charcoal truncate">
              {fullName}
            </p>
            <p className="text-xs text-mist truncate">{email}</p>
          </div>

          {/* Menu items */}
          <a
            href={profileHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-charcoal hover:bg-cloud transition-colors"
          >
            <span className="text-base leading-none">◇</span>
            My Profile
          </a>
          <a
            href="/admin/settings/profile#password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-charcoal hover:bg-cloud transition-colors"
          >
            <span className="text-base leading-none">◈</span>
            Change Password
          </a>

          <div className="border-t border-silver my-1" />

          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <span className="text-base leading-none">↗</span>
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
