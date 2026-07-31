"use client";

import { useEffect } from "react";

/**
 * Root error boundary.
 *
 * This is the only boundary that catches a throw from a route-group layout
 * (`app/(admin)/layout.tsx`, `app/(teach)/layout.tsx`, `app/(portal)/layout.tsx`).
 * A boundary placed at `app/(admin)/error.tsx` would render *inside* that
 * group's layout, so it can never catch that layout failing — which is exactly
 * the failure the auth resolvers now raise. Keep this file working.
 *
 * Prior to this, no error.tsx existed anywhere in app/, so any server-side
 * throw produced Next's unstyled default 500 with no route back to sign-in.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-3xl font-semibold text-charcoal mb-3">
          Something went wrong
        </h1>
        <p className="text-slate mb-6">
          We couldn&apos;t load this page. This is usually temporary — try
          again, or sign in again if the problem continues.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-lavender px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-lavender-dark"
          >
            Try again
          </button>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-silver px-5 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-white"
          >
            Sign in again
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-mist">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
