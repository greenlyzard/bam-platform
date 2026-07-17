import { EnrollmentCartView } from "./cart-view";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Your Cart — Ballet Academy and Movement",
  description: "Review your selected classes and proceed to checkout.",
};

export default async function CartPage() {
  // Studio-level registration fee (one-time, due today). Service role: studio_settings RLS is
  // authenticated-only and this cart is reachable by anonymous enrollees.
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("studio_settings")
    .select("registration_fee_cents")
    .limit(1)
    .maybeSingle();
  const registrationFeeCents =
    (settings?.registration_fee_cents as number | undefined) ?? 0;

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-lavender py-6">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <a href="/" className="inline-block">
            <h1 className="font-heading text-xl font-semibold text-white tracking-wide">
              Ballet Academy and Movement
            </h1>
          </a>
          <p className="mt-1 text-sm text-white/80">
            San Clemente, California
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <EnrollmentCartView registrationFeeCents={registrationFeeCents} />
      </main>

      <footer className="border-t border-silver py-6 text-center">
        <p className="text-xs text-mist">
          Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente,
          CA 92672 · (949) 229-0846
        </p>
      </footer>
    </div>
  );
}
