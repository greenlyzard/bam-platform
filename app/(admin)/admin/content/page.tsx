import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function ContentPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          LMS Content
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage learning content library and analytics.
        </p>
      </div>
      <EmptyState
        icon="▶"
        title="Coming soon"
        description="Content library management, upload analytics, and student engagement metrics will be available here."
      />
    </div>
  );
}
