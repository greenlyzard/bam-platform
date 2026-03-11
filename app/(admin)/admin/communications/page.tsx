import { requireAdmin } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function CommunicationsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Communications
        </h1>
        <p className="mt-1 text-sm text-slate">
          Send announcements to targeted audiences via email, SMS, or in-app.
        </p>
      </div>
      <EmptyState
        icon="✉"
        title="Coming soon"
        description="Announcement builder with audience targeting by season, class, or performance will be available here."
      />
    </div>
  );
}
