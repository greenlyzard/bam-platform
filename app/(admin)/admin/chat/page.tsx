import { AngelinaChat } from "@/components/angelina/AngelinaChat";
import { createClient } from "@/lib/supabase/server";

export default async function AdminChatPage() {
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
        Angelina — AI Assistant
      </h1>
      {angelinaEnabled ? (
        <>
          <p className="text-sm text-slate mb-4">
            Full studio data access. Ask about enrollment, schedules, leads, staffing, capacity, and more.
          </p>
          <AngelinaChat role="admin" mode="fullpage" />
        </>
      ) : (
        <p className="text-sm text-mist">
          The Angelina AI assistant is currently disabled. You can re-enable it in{" "}
          <a href="/admin/settings/angelina" className="text-lavender hover:text-lavender-dark">
            Settings
          </a>.
        </p>
      )}
    </div>
  );
}
