import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function BillingPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Billing &amp; Finance
        </h1>
        <p className="mt-1 text-sm text-slate">
          Invoices, tuition plans, revenue reports, and payment processing.
        </p>
      </div>
      <EmptyState
        icon="✦"
        title="Coming soon"
        description="Revenue overview, outstanding balances, tuition aging reports, and Stripe payment management will be available here."
      />
    </div>
  );
}
