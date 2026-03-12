import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmbedForm } from "../../embed-form";

export default async function EditEmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: embed, error } = await supabase
    .from("schedule_embeds")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !embed) {
    redirect("/admin/schedule-embeds");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Edit Schedule Embed
        </h1>
        <p className="mt-1 text-sm text-slate">{embed.name}</p>
      </div>
      <EmbedForm
        initialData={embed}
        embedId={embed.id}
        embedToken={embed.embed_token}
      />
    </div>
  );
}
