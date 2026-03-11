import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function SeasonsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Seasons
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage seasons, registration windows, and class catalogs.
        </p>
      </div>
      <EmptyState
        icon="◈"
        title="Coming soon"
        description="Season management with registration windows and class catalog configuration will be available here."
      />
    </div>
  );
}
