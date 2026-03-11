import { requireTeacher } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function AssessmentsPage() {
  await requireTeacher();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Skill Assessments
        </h1>
        <p className="mt-1 text-sm text-slate">
          Evaluate student skills across technique, musicality, and artistry.
        </p>
      </div>

      <EmptyState
        icon="▲"
        title="Coming soon"
        description="Skill assessments will be available here. Rate students on a 5-point scale across multiple skill areas."
      />
    </div>
  );
}
