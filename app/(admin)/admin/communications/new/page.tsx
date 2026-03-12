import { requireAdmin } from "@/lib/auth/guards";
import { AnnouncementForm } from "@/components/communications/AnnouncementForm";

export default async function NewAnnouncementPage() {
  await requireAdmin();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <a
            href="/admin/communications"
            className="text-sm text-lavender hover:text-lavender-dark transition-colors"
          >
            ← Communications
          </a>
        </div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          New Announcement
        </h1>
        <p className="mt-1 text-sm text-slate">
          Compose and send an announcement to parents, teachers, or the entire
          studio.
        </p>
      </div>

      <div className="rounded-xl border border-silver bg-white p-6">
        <AnnouncementForm />
      </div>
    </div>
  );
}
