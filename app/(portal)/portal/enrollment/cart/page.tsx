import { requireParent } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalCartView } from "./cart-view";

export const metadata = { title: "Your Cart" };

export default async function PortalCartPage() {
  await requireParent();

  // Studio-level one-time registration fee (shown in the summary; charged only after approval).
  // Service role: studio_settings RLS is authenticated-only.
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("studio_settings")
    .select("registration_fee_cents")
    .limit(1)
    .maybeSingle();
  const registrationFeeCents =
    (settings?.registration_fee_cents as number | undefined) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Your Cart
        </h1>
        <p className="mt-1 text-sm text-slate">
          Review your selected classes, then continue to checkout.
        </p>
      </div>

      <PortalCartView registrationFeeCents={registrationFeeCents} />
    </div>
  );
}
