"use client";

import { signOut } from "@/lib/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          className ??
          "text-sm text-slate hover:text-charcoal transition-colors"
        }
      >
        Sign out
      </button>
    </form>
  );
}
