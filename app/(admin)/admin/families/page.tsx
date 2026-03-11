import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function FamiliesPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Families
        </h1>
        <p className="mt-1 text-sm text-slate">
          Family directory with contacts, balances, and communications.
        </p>
      </div>
      <EmptyState
        icon="◇"
        title="Coming soon"
        description="Family management with contact info, payment history, and student associations will be available here."
      />
    </div>
  );
}
