import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function ReportsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Reports
        </h1>
        <p className="mt-1 text-sm text-slate">
          Enrollment, attendance, financial, and growth reports.
        </p>
      </div>
      <EmptyState
        icon="▲"
        title="Coming soon"
        description="Revenue reports, enrollment analytics, attendance trends, and QuickBooks export will be available here."
      />
    </div>
  );
}
