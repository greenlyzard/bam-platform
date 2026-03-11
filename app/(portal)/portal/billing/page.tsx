import { requireParent } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function BillingPage() {
  await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Billing
        </h1>
        <p className="mt-1 text-sm text-slate">
          Tuition, payment history, and manage payment methods.
        </p>
      </div>

      <EmptyState
        icon="✦"
        title="Coming soon"
        description="Online tuition payments and billing history will be available here shortly."
      />
    </div>
  );
}
