"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { AssistantConfig } from "@/lib/assistant/config";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface PaymentCardProps {
  config: AssistantConfig;
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function PaymentForm({
  config,
  amount,
  onSuccess,
  onError,
}: { config: AssistantConfig } & Omit<PaymentCardProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/enroll?payment=success`,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message || "Payment failed. Please try again.");
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-lg bg-cream p-3">
        <div className="flex justify-between text-xs text-mist">
          <span>First payment</span>
          <span className="font-medium text-charcoal">
            ${(amount / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <PaymentElement options={{ layout: "tabs" }} />

      <button
        type="submit"
        disabled={!stripe || loading}
        style={{ backgroundColor: config.primaryColor }}
        className="h-10 w-full rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Complete Enrollment"}
      </button>

      <p className="text-center text-[10px] text-mist">
        Your payment is secured by Stripe. We never store your card details.
      </p>
    </form>
  );
}

export function PaymentCard({
  config,
  clientSecret,
  amount,
  onSuccess,
  onError,
}: PaymentCardProps) {
  return (
    <div
      style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <p className="mb-3 text-sm font-medium text-charcoal">Payment</p>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: config.primaryColor,
              borderRadius: "8px",
              fontFamily: "Montserrat, sans-serif",
              fontSizeBase: "14px",
            },
          },
        }}
      >
        <PaymentForm
          config={config}
          amount={amount}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  );
}
