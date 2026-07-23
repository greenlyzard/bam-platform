"use client";

import { useState } from "react";
import Link from "next/link";
import { usePortalCart } from "@/lib/portal-cart-context";
import { formatCurrency } from "@/lib/utils";

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
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function PortalCartView({
  registrationFeeCents,
}: {
  registrationFeeCents: number;
}) {
  const { items, count, totalCents, loading, removeItem } = usePortalCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [agreed, setAgreed] = useState(false);
  // Classes the studio reports as full (§3.3): completing checkout waitlists them. The parent must
  // knowingly proceed (a `confirm` follow-up) before we create the session.
  const [fullClasses, setFullClasses] = useState<{ class_id: string; name: string }[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(itemId: string) {
    setRemoving(itemId);
    await removeItem(itemId);
    setRemoving(null);
  }

  async function handleCheckout(confirm = false) {
    setCheckingOut(true);
    setCheckoutError("");

    try {
      // The cart is already persisted server-side (added via /api/enrollment/cart), so we go
      // straight to checkout — no client→server sync step like the public flow needs.
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

  if (loading && count === 0) {
    return <p className="text-sm text-mist">Loading your cart…</p>;
  }

  if (count === 0) {
    return (
      <div className="rounded-xl border border-silver bg-white p-8 text-center space-y-4">
        <h2 className="font-heading text-xl font-semibold text-charcoal">
          Your cart is empty
        </h2>
        <p className="text-sm text-slate">
          Browse classes and add the ones you&apos;d like to enroll in.
        </p>
        <Link
          href="/portal/enrollment"
          className="inline-flex h-11 items-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors"
        >
          Browse Classes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-silver bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-semibold text-charcoal truncate">
                  {item.class_name}
                </h3>
                <p className="text-xs text-slate">
                  {DAYS[item.day_of_week]}s &middot; {formatTime(item.start_time)}&ndash;
                  {formatTime(item.end_time)}
                  {item.teacher_name ? ` · ${item.teacher_name}` : ""}
                  {item.room ? ` · ${item.room}` : ""}
                </p>
                {item.student_name && (
                  <p className="text-xs text-mist">
                    For: <span className="font-medium">{item.student_name}</span>
                  </p>
                )}
              </div>

              <div className="text-right shrink-0 space-y-1">
                {item.price_cents ? (
                  <p className="text-sm font-semibold text-charcoal">
                    {formatCurrency(item.price_cents)}/mo
                  </p>
                ) : (
                  <p className="text-xs text-mist">Price TBD</p>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  disabled={removing === item.id}
                  className="text-xs text-mist hover:text-error font-medium transition-colors disabled:opacity-50"
                >
                  {removing === item.id ? "Removing…" : "Remove"}
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
            Monthly tuition ({count} class{count !== 1 ? "es" : ""}) &middot; from the 15th
          </span>
          <span className="font-medium text-charcoal">
            {formatCurrency(totalCents)}/mo
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
          then draws on the 15th.
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
          href="/portal/enrollment"
          className="flex h-11 items-center justify-center rounded-lg border border-silver text-slate hover:text-charcoal hover:border-lavender font-medium text-sm transition-colors w-full"
        >
          Add More Classes
        </Link>
      </div>
    </div>
  );
}
