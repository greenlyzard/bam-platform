import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { createClient } from "@/lib/supabase/server";

export default async function TeachChatPage() {
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("angelina_enabled")
    .eq("slug", "bam")
    .single();
  const angelinaEnabled = tenant?.angelina_enabled ?? true;

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-charcoal mb-4">
        Chat with Angelina
      </h1>
      {angelinaEnabled ? (
        <>
          <p className="text-sm text-slate mb-4">
            Ask about your schedule, student rosters, hour logging, and substitute requests.
          </p>
          <AngelinaChat role="teacher" mode="fullpage" />
        </>
      ) : (
        <p className="text-sm text-mist">
          The Angelina AI assistant is currently disabled by your administrator.
        </p>
      )}
    </div>
  );
}
