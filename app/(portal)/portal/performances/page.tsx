import { requireParent } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function PerformancesPage() {
  await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Performances
        </h1>
        <p className="mt-1 text-sm text-slate">
          Your dancers&apos; roles, rehearsal schedules, and show dates.
        </p>
      </div>

      <EmptyState
        icon="★"
        title="Coming soon"
        description="Performance casting, rehearsal schedules, and show information will appear here once a production is set up."
      />
    </div>
  );
}
