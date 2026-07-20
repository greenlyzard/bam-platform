"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function EnrollmentCartView({
  registrationFeeCents,
}: {
  /** Studio-level one-time registration fee in cents, resolved server-side (cart/page.tsx). */
  registrationFeeCents: number;
}) {
  const { items, removeItem, itemCount } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  // Open-authorization consent (card-on-file + ACH mandate) — AUTHORIZATION_CHECKOUT.md §6.
  const [agreed, setAgreed] = useState(false);
  // Classes the studio reports as full (§3.3): completing checkout waitlists them. The parent must
  // knowingly proceed (a `confirm` follow-up) before we create the session.
  const [fullClasses, setFullClasses] = useState<{ class_id: string; name: string }[]>([]);

  async function handleCheckout(confirm = false) {
    setCheckingOut(true);
    setCheckoutError("");

    try {
      // Sync cart to server first. Price is resolved server-side from the class — the client
      // no longer computes or sends price_cents.
      for (const item of items) {
        await fetch("/api/enrollment/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_id: item.classInfo.id,
            // Real student when a returning family enrolled an existing dancer;
            // omitted for a new dancer (server accepts student_name only).
            ...(item.studentId ? { student_id: item.studentId } : {}),
            student_name: item.childName,
          }),
        });
      }

      // Create Stripe Checkout Session (confirm=true acknowledges any waitlisted classes).
      const res = await fetch("/api/enrollment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });

      const data = await res.json();

      if (data.error) {
        setCheckoutError(data.error);
        setCheckingOut(false);
        return;
      }

      // Some classes are full — show the waitlist notice and let the parent proceed knowingly.
      if (data.requiresConfirm) {
        setFullClasses(data.fullClasses ?? []);
        setCheckingOut(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setCheckoutError("Failed to start checkout. Please try again.");
      setCheckingOut(false);
    }
  }

  if (itemCount === 0) {
    return (
      <div className="space-y-6 text-center py-12">
        <div className="mx-auto h-16 w-16 rounded-full bg-lavender/10 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-lavender"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
            />
          </svg>
        </div>
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Your cart is empty
        </h2>
        <p className="text-sm text-slate">
          Take our enrollment quiz to find the right classes.
        </p>
        <Link
          href="/enroll"
          className="inline-flex h-12 items-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-8 transition-colors"
        >
          Find Classes
        </Link>
      </div>
    );
  }

  // Vault-only checkout (BILLING_APPROVAL_AND_DRAW.md §1.2): the card is SAVED, and NOTHING is
  // charged at checkout — not even registration. The registration fee and the prorated first month
  // are charged only after the studio approves; ongoing tuition draws on the 15th. So "due today" is
  // always nothing; the amounts below are what will be charged after review.
  const monthlyTuitionCents = items.reduce(
    (sum, item) => sum + (item.classInfo.monthlyTuitionCents ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Your Selected Classes
        </h2>
        <p className="mt-1 text-sm text-slate">
          Review your selections, then continue to checkout.
        </p>
      </div>

      {/* Cart items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.classInfo.id}
            className="rounded-xl border border-silver bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-charcoal truncate">
                    {item.classInfo.name}
                  </h3>
                  {item.type === "waitlist" && (
                    <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium shrink-0">
                      Waitlist
                    </span>
                  )}
                  {item.type === "trial" && (
                    <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium shrink-0">
                      Free Trial
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate">
                  {DAYS[item.classInfo.dayOfWeek]}s &middot;{" "}
                  {formatTime(item.classInfo.startTime)}&ndash;
                  {formatTime(item.classInfo.endTime)}
                  {item.classInfo.teacherName &&
                    ` · ${item.classInfo.teacherName}`}
                </p>
                <p className="text-xs text-mist">
                  For: <span className="font-medium">{item.childName}</span>
                </p>
              </div>

              <div className="text-right shrink-0 space-y-1">
                {item.classInfo.monthlyTuitionCents ? (
                  <p className="text-sm font-semibold text-charcoal">
                    {formatCurrency(item.classInfo.monthlyTuitionCents)}/mo
                  </p>
                ) : (
                  <p className="text-xs text-mist">Price TBD</p>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.classInfo.id)}
                  className="text-xs text-mist hover:text-error font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary — vault-only: nothing is charged today; these are charged after studio review. */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
        {registrationFeeCents > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate">Registration fee (one-time)</span>
            <span className="font-medium text-charcoal">
              {formatCurrency(registrationFeeCents)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate">
            Monthly tuition ({itemCount} class{itemCount !== 1 ? "es" : ""}) &middot; from the 15th
          </span>
          <span className="font-medium text-charcoal">
            {formatCurrency(monthlyTuitionCents)}/mo
          </span>
        </div>
        <hr className="border-silver" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-charcoal">Due today</span>
          <span className="text-lg font-semibold text-charcoal">Nothing</span>
        </div>
        <p className="text-xs text-mist">
          Your card is securely saved &mdash; nothing is charged today. After the studio reviews your
          enrollment, we charge the registration fee and your prorated first month; monthly tuition
          then draws on the 15th. Your first class is always a free trial &mdash; if it&apos;s not the
          right fit, we&apos;ll refund in full.
        </p>
      </div>

      {/* Checkout error */}
      {checkoutError && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {checkoutError}
        </div>
      )}

      {/* Waitlist notice (§3.3) — one or more classes are full. */}
      {fullClasses.length > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-charcoal">
          <p className="font-semibold">
            {fullClasses.map((c) => c.name).join(", ")}{" "}
            {fullClasses.length === 1 ? "is" : "are"} currently full.
          </p>
          <p className="mt-1 text-xs text-slate">
            Completing checkout adds you to the waitlist for{" "}
            {fullClasses.length === 1 ? "that class" : "those classes"} — we&apos;ll notify you if a
            spot opens. <span className="font-medium">Nothing is charged for waitlisted classes.</span>{" "}
            Your other classes proceed to studio review as usual.
          </p>
        </div>
      )}

      {/* Open-authorization consent (card-on-file + ACH mandate) — spec §6. Wording TBD by counsel. */}
      <label className="flex items-start gap-2 rounded-lg border border-silver/60 bg-white/60 px-4 py-3 text-xs text-slate">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-lavender"
        />
        <span>
          I authorize Ballet Academy and Movement to securely store my payment method and charge it
          on an ongoing basis for monthly tuition (drawn on the 15th) and studio-approved fees
          (registration, costumes, competitions, and adjustments), until I cancel in writing. This is
          a card-on-file authorization, and where I pay by bank account, an ACH (Nacha) debit
          authorization.
        </span>
      </label>

      {/* Actions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleCheckout(fullClasses.length > 0)}
          disabled={checkingOut || !agreed}
          className="flex h-12 items-center justify-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors w-full disabled:opacity-40"
        >
          {checkingOut
            ? "Redirecting to payment..."
            : fullClasses.length > 0
              ? "Add to waitlist & continue"
              : "Proceed to Checkout"}
        </button>
        <Link
          href="/enroll"
          className="flex h-11 items-center justify-center rounded-lg border border-silver text-slate hover:text-charcoal hover:border-lavender font-medium text-sm transition-colors w-full"
        >
          Add More Classes
        </Link>
      </div>
    </div>
  );
}
