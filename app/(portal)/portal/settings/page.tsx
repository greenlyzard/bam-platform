import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Account Settings" };

export default async function SettingsPage() {
  const user = await requireParent();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage your profile, email, and password.
        </p>
      </div>

      <SettingsForm
        profile={{
          first_name: profile?.first_name ?? "",
          last_name: profile?.last_name ?? "",
          email: profile?.email ?? user.email,
          phone: profile?.phone ?? "",
          avatar_url: profile?.avatar_url ?? null,
        }}
      />
    </div>
  );
}
