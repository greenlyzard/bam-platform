import { requireParent } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function LearningPage() {
  await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Learning
        </h1>
        <p className="mt-1 text-sm text-slate">
          Your dancers&apos; progress in the Ballet Academy and Movement
          Learning Studio.
        </p>
      </div>

      <EmptyState
        icon="◆"
        title="Coming soon"
        description="Learning content, skill assessments, and progress tracking will be available here."
      />
    </div>
  );
}
