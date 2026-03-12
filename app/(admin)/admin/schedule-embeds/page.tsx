import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CopyIframeButton } from "./copy-button";

export default async function ScheduleEmbedsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: embeds } = await supabase
    .from("schedule_embeds")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Schedule Embeds
          </h1>
          <p className="mt-1 text-sm text-slate">
            Manage embeddable schedule widgets for your website
          </p>
        </div>
        <a
          href="/admin/schedule-embeds/new"
          className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
        >
          Create Embed
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {embeds?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate">Total Embeds</p>
        </div>
      </div>

      {/* Angelina Chat Widget Embed */}
      <div className="rounded-xl border border-silver bg-white p-4">
        <h3 className="font-semibold text-charcoal mb-2">
          Angelina Chat Widget
        </h3>
        <p className="text-xs text-slate mb-3">
          Embed the AI chat assistant on your WordPress site for lead capture and
          visitor engagement.
        </p>
        <div className="bg-cream rounded-lg p-3 text-xs font-mono text-charcoal break-all select-all">
          {`<iframe src="${process.env.NEXT_PUBLIC_APP_URL || "https://portal.balletacademyandmovement.com"}/widget/angelina" width="400" height="600" frameborder="0" style="border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1);"></iframe>`}
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href="/widget/angelina"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-lavender hover:bg-lavender/10 transition-colors"
          >
            Preview Widget
          </a>
        </div>
      </div>

      {embeds && embeds.length > 0 ? (
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {embeds.map((embed) => (
            <div
              key={embed.id}
              className="px-4 py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <h3 className="font-semibold text-charcoal truncate">
                  {embed.name}
                </h3>
                <p className="text-xs text-mist mt-1">
                  Mode: {embed.display_mode} &middot; Created{" "}
                  {new Date(embed.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CopyIframeButton token={embed.embed_token} />
                <a
                  href={`/widget/schedule/${embed.embed_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
                >
                  Preview
                </a>
                <a
                  href={`/admin/schedule-embeds/${embed.id}/edit`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-lavender hover:bg-lavender/10 transition-colors"
                >
                  Edit
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No embeds yet</p>
          <a
            href="/admin/schedule-embeds/new"
            className="mt-2 inline-block text-sm font-medium text-lavender hover:text-lavender-dark transition-colors"
          >
            Create your first embed
          </a>
        </div>
      )}
    </div>
  );
}
