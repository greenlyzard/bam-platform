import { requireTeacher } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function AwardBadgesPage() {
  await requireTeacher();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Award Badges
        </h1>
        <p className="mt-1 text-sm text-slate">
          Recognize student achievements with badges.
        </p>
      </div>

      <EmptyState
        icon="◆"
        title="Coming soon"
        description="Badge awarding will be available here. You'll be able to award badges to individual students or in bulk."
      />
    </div>
  );
}
