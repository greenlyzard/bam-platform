import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function CompliancePage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Legal &amp; Compliance
        </h1>
        <p className="mt-1 text-sm text-slate">
          Document tracking, waivers, and mandated reporter status.
        </p>
      </div>
      <EmptyState
        icon="◆"
        title="Coming soon"
        description="Mandated reporter log, background check tracking, waiver management, and California compliance requirements will be available here."
      />
    </div>
  );
}
