import { requireParent } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function LiveViewingPage() {
  await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Live Viewing
        </h1>
        <p className="mt-1 text-sm text-slate">
          Watch classes and performances in real time.
        </p>
      </div>

      <EmptyState
        icon="▶"
        title="Coming soon"
        description="Live class viewing will be available here once streaming is configured by the studio."
      />
    </div>
  );
}
