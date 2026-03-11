import { requireParent } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function MessagesPage() {
  await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Messages
        </h1>
        <p className="mt-1 text-sm text-slate">
          Conversations with teachers and studio staff.
        </p>
      </div>

      <EmptyState
        icon="✉"
        title="Coming soon"
        description="Studio messaging will be available here. For now, reach out at dance@bamsocal.com or (949) 229-0846."
      />
    </div>
  );
}
