import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { createClient } from "@/lib/supabase/server";

export default async function PortalChatPage() {
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
            Ask about your dancer&apos;s schedule, classes, rehearsals, attendance, and more.
          </p>
          <AngelinaChat role="parent" mode="fullpage" />
        </>
      ) : (
        <p className="text-sm text-mist">
          The Angelina AI assistant is currently unavailable.
        </p>
      )}
    </div>
  );
}
