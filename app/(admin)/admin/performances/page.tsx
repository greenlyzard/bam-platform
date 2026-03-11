import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function PerformancesPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Performances
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage productions, casting, and rehearsal schedules.
        </p>
      </div>
      <EmptyState
        icon="♛"
        title="Coming soon"
        description="Performance management with casting board, rehearsal scheduler, and quick-change conflict detection will be available here."
      />
    </div>
  );
}
