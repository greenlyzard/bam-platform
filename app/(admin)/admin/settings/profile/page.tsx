import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsForm } from "./ProfileSettingsForm";

export default async function ProfileSettingsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, avatar_url, preferred_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage your account settings and preferences.
        </p>
      </div>
      <ProfileSettingsForm
        profile={{
          id: profile?.id ?? user.id,
          firstName: profile?.first_name ?? "",
          lastName: profile?.last_name ?? "",
          preferredName: profile?.preferred_name ?? "",
          email: profile?.email ?? user.email,
          phone: profile?.phone ?? "",
          avatarUrl: profile?.avatar_url ?? "",
          role: profile?.role ?? "parent",
        }}
      />
    </div>
  );
}
