import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AssistantConfigEditor } from "./assistant-config-editor";

export const metadata = {
  title: "Assistant Configuration — Settings",
};

export default async function AssistantSettingsPage() {
  const user = await requireAdmin();
  const tenantId = user.tenantId ?? "84d98f72-c82f-414f-8b17-172b802f6993";

  const supabase = await createClient();
  const { data: config } = await supabase
    .from("tenant_assistant_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AssistantConfigEditor config={config} tenantId={tenantId} />
    </div>
  );
}
