import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function StudentsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Students
        </h1>
        <p className="mt-1 text-sm text-slate">
          Student directory with enrollment history and progress.
        </p>
      </div>
      <EmptyState
        icon="♡"
        title="Coming soon"
        description="Searchable student directory with enrollment history, attendance records, and skill assessments will be available here."
      />
    </div>
  );
}
