import Stripe from "stripe";

let _stripe: Stripe | null = null;

export type StripeMode = "test" | "live";

/**
 * Detect test vs live mode from the secret key prefix.
 * `sk_live_` / `rk_live_` → live; anything else (incl. `sk_test_`, unset) → test (safe default).
 */
export function getStripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
}

export function isStripeTestMode(): boolean {
  return getStripeMode() === "test";
}

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    // Guard against a live secret key paired with a test publishable key (or vice-versa) —
    // a common misconfiguration that silently charges the wrong Stripe account.
    const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    if (pub) {
      const pubMode: StripeMode = pub.startsWith("pk_live_") ? "live" : "test";
      if (pubMode !== getStripeMode()) {
        console.warn(
          `[stripe] MODE MISMATCH: secret key is ${getStripeMode()} but publishable key is ${pubMode}. Set matching test/live keys.`
        );
      }
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return _stripe;
}
