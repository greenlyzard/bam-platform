import { requireTeacher } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function MessagesPage() {
  await requireTeacher();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Messages
        </h1>
        <p className="mt-1 text-sm text-slate">
          Communicate with parents and studio staff.
        </p>
      </div>

      <EmptyState
        icon="✉"
        title="Coming soon"
        description="Parent and staff messaging will be available here. For now, reach out at dance@bamsocal.com."
      />
    </div>
  );
}
