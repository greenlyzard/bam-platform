"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function EnrollmentConfirmation() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  const redirectStatus = searchParams.get("redirect_status");
  const paymentIntent = searchParams.get("payment_intent");

  useEffect(() => {
    if (redirectStatus === "succeeded") {
      setStatus("success");
    } else if (redirectStatus === "failed" || redirectStatus === "canceled") {
      setStatus("error");
    } else if (paymentIntent) {
      // Payment intent exists but no explicit status — likely succeeded
      setStatus("success");
    } else {
      setStatus("error");
    }
  }, [redirectStatus, paymentIntent]);

  if (status === "loading") {
    return (
      <div className="text-center py-16">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
        <p className="mt-4 text-sm text-slate">Confirming your enrollment...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-6 text-center py-12">
        <div className="mx-auto h-16 w-16 rounded-full bg-error/10 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-error"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Something went wrong
        </h2>
        <p className="text-sm text-slate max-w-md mx-auto">
          Your payment may not have gone through. Please contact us at (949)
          229-0846 or dance@bamsocal.com and we&apos;ll sort it out.
        </p>
        <Link
          href="/enroll"
          className="inline-flex h-12 items-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-8 transition-colors"
        >
          Try Again
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center py-8">
      <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
        <svg
          className="h-8 w-8 text-success"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>
      <h2 className="font-heading text-2xl font-semibold text-charcoal">
        You&apos;re all set!
      </h2>
      <p className="text-sm text-slate max-w-md mx-auto">
        Your enrollment is confirmed and payment has been processed. Check your
        email for a receipt and class details. We can&apos;t wait to see you in
        the studio!
      </p>
      <div className="pt-2 space-y-3">
        <Link
          href="/portal/dashboard"
          className="flex h-12 items-center justify-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors w-full max-w-xs mx-auto"
        >
          Go to My Dashboard
        </Link>
        <Link
          href="/"
          className="flex h-11 items-center justify-center text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
