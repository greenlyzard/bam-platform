import { requireTeacher } from "@/lib/auth/guards";
import { EmptyState } from "@/components/bam/empty-state";

export default async function ContentPage() {
  await requireTeacher();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Content
        </h1>
        <p className="mt-1 text-sm text-slate">
          Upload and manage learning content for the Ballet Academy and Movement
          Learning Studio.
        </p>
      </div>

      <EmptyState
        icon="▶"
        title="Coming soon"
        description="Video upload, content management, and feed curation will be available here."
      />
    </div>
  );
}
