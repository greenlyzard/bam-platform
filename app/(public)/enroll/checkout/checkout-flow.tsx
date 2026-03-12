"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import type { ChildFormData } from "@/types/enrollment";

// ─── Stripe setup ──────────────────────────────────────

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

// ─── Child info form ───────────────────────────────────

interface ChildInfoStepProps {
  childNames: string[];
  onSubmit: (
    parentInfo: { firstName: string; lastName: string; email: string; phone: string },
    children: ChildFormData[]
  ) => void;
  loading: boolean;
}

function ChildInfoStep({ childNames, onSubmit, loading }: ChildInfoStepProps) {
  const [parentFirst, setParentFirst] = useState("");
  const [parentLast, setParentLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [childrenData, setChildrenData] = useState<ChildFormData[]>(() =>
    childNames.map((name) => ({
      firstName: name,
      lastName: "",
      dateOfBirth: "",
      medicalNotes: "",
    }))
  );

  const uniqueChildren = useMemo(() => {
    const seen = new Set<string>();
    return childNames.filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [childNames]);

  // Re-derive unique children for the form
  const uniqueChildrenData = useMemo(() => {
    const result: ChildFormData[] = [];
    const seen = new Set<string>();
    for (const child of childrenData) {
      if (!seen.has(child.firstName)) {
        seen.add(child.firstName);
        result.push(child);
      }
    }
    return result;
  }, [childrenData]);

  function updateChild(index: number, field: keyof ChildFormData, value: string) {
    setChildrenData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  const canSubmit =
    parentFirst.trim() &&
    parentLast.trim() &&
    email.trim() &&
    uniqueChildrenData.every((c) => c.lastName.trim() && c.dateOfBirth);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Family Information
        </h2>
        <p className="mt-1 text-sm text-slate">
          We need a few details before payment.
        </p>
      </div>

      {/* Parent info */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
        <h3 className="font-heading text-base font-semibold text-charcoal">
          Parent / Guardian
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="First name"
            value={parentFirst}
            onChange={(e) => setParentFirst(e.target.value)}
            autoComplete="given-name"
            className="h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Last name"
            value={parentLast}
            onChange={(e) => setParentLast(e.target.value)}
            autoComplete="family-name"
            className="h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
        />
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
        />
      </div>

      {/* Child info (one card per unique child name) */}
      {uniqueChildren.map((name, idx) => (
        <div
          key={name}
          className="rounded-xl border border-silver bg-white p-5 space-y-4"
        >
          <h3 className="font-heading text-base font-semibold text-charcoal">
            {name}&apos;s Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-mist mb-1">
                First name
              </label>
              <input
                type="text"
                value={uniqueChildrenData[idx]?.firstName ?? name}
                readOnly
                className="w-full h-11 rounded-lg border border-silver bg-cloud px-4 text-sm text-slate"
              />
            </div>
            <div>
              <label className="block text-xs text-mist mb-1">Last name</label>
              <input
                type="text"
                placeholder="Last name"
                value={uniqueChildrenData[idx]?.lastName ?? ""}
                onChange={(e) => updateChild(idx, "lastName", e.target.value)}
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-mist mb-1">
              Date of birth
            </label>
            <input
              type="date"
              value={uniqueChildrenData[idx]?.dateOfBirth ?? ""}
              onChange={(e) => updateChild(idx, "dateOfBirth", e.target.value)}
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-mist mb-1">
              Medical notes or allergies (optional)
            </label>
            <textarea
              value={uniqueChildrenData[idx]?.medicalNotes ?? ""}
              onChange={(e) => updateChild(idx, "medicalNotes", e.target.value)}
              placeholder="Anything we should know?"
              rows={2}
              className="w-full rounded-lg border border-silver bg-white px-4 py-2.5 text-sm placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        disabled={!canSubmit || loading}
        onClick={() =>
          onSubmit(
            {
              firstName: parentFirst.trim(),
              lastName: parentLast.trim(),
              email: email.trim(),
              phone: phone.trim(),
            },
            uniqueChildrenData
          )
        }
        className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
      >
        {loading ? "Preparing payment..." : "Continue to Payment"}
      </button>

      <Link
        href="/enroll/cart"
        className="flex h-11 items-center justify-center text-sm text-lavender hover:text-lavender-dark font-medium"
      >
        Back to cart
      </Link>
    </div>
  );
}

// ─── Payment form (inside Stripe Elements) ─────────────

function PaymentForm({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/enroll/confirmation`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Payment
        </h2>
        <p className="mt-1 text-sm text-slate">
          Total due: <span className="font-semibold">{formatCurrency(amount)}</span>
        </p>
      </div>

      <div className="rounded-xl border border-silver bg-white p-5">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full h-12 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors disabled:opacity-40"
      >
        {submitting ? "Processing..." : `Pay ${formatCurrency(amount)}`}
      </button>

      <p className="text-center text-xs text-mist">
        Your payment is secured by Stripe. We never store your card details.
      </p>
    </form>
  );
}

// ─── Success confirmation ──────────────────────────────

function SuccessView() {
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
        Your enrollment is confirmed. Check your email for a receipt and class
        details. We can&apos;t wait to see you in the studio!
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

// ─── Main checkout orchestrator ────────────────────────

type CheckoutStep = "info" | "payment" | "success";

export function CheckoutFlow() {
  const { items, totalCents, registrationTotalCents, itemCount, clearCart } =
    useCart();
  const [step, setStep] = useState<CheckoutStep>("info");
  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const childNames = useMemo(
    () => items.map((item) => item.childName),
    [items]
  );

  const handleInfoSubmit = useCallback(
    async (
      parentInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      },
      _children: ChildFormData[]
    ) => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/enroll/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({
              classId: item.classInfo.id,
              className: item.classInfo.name,
              childName: item.childName,
              monthlyTuitionCents: item.classInfo.monthlyTuitionCents ?? 0,
              registrationFeeCents: item.classInfo.registrationFeeCents ?? 0,
            })),
            parentEmail: parentInfo.email,
            parentName: `${parentInfo.firstName} ${parentInfo.lastName}`,
          }),
        });

        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        setClientSecret(data.clientSecret);
        setAmount(data.amount);
        setStep("payment");
      } catch {
        setError("Failed to initialize payment. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [items]
  );

  const handlePaymentSuccess = useCallback(() => {
    clearCart();
    setStep("success");
  }, [clearCart]);

  if (itemCount === 0 && step !== "success") {
    return (
      <div className="space-y-6 text-center py-12">
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Nothing to check out
        </h2>
        <p className="text-sm text-slate">
          Add classes to your cart first.
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

  // Progress indicator
  const steps = [
    { key: "info", label: "Details" },
    { key: "payment", label: "Payment" },
    { key: "success", label: "Confirmed" },
  ] as const;

  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-8">
      {/* Progress steps */}
      <div className="flex items-center justify-center gap-3">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i <= currentIdx
                    ? "bg-lavender text-white"
                    : "bg-silver text-mist"
                }`}
              >
                {i < currentIdx ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  i <= currentIdx ? "text-charcoal" : "text-mist"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-8 ${
                  i < currentIdx ? "bg-lavender" : "bg-silver"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {step === "info" && (
        <>
          {/* Order summary sidebar */}
          <div className="rounded-xl border border-lavender/20 bg-lavender/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-charcoal">
                {itemCount} class{itemCount !== 1 ? "es" : ""} selected
              </span>
              <span className="font-semibold text-charcoal">
                {formatCurrency(totalCents + registrationTotalCents)} due today
              </span>
            </div>
          </div>

          <ChildInfoStep
            childNames={childNames}
            onSubmit={handleInfoSubmit}
            loading={loading}
          />
        </>
      )}

      {step === "payment" && clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#9C8BBF",
                colorBackground: "#ffffff",
                colorText: "#2D2A33",
                colorDanger: "#C45B5B",
                fontFamily: "Montserrat, sans-serif",
                borderRadius: "8px",
              },
            },
          }}
        >
          <PaymentForm amount={amount} onSuccess={handlePaymentSuccess} />
        </Elements>
      )}

      {step === "success" && <SuccessView />}
    </div>
  );
}
