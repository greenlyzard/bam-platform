import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FeatureFlagManager } from "./FeatureFlagManager";

export default async function SuperAdminPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  // Only derek@greenlyzard.com or super_admin
  if (
    profile?.role !== "super_admin" &&
    profile?.email !== "derek@greenlyzard.com"
  ) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Super Admin
        </h1>
        <p className="mt-1 text-sm text-mist">
          Feature flags, system configuration, and platform controls.
        </p>
      </div>
      <FeatureFlagManager />
    </div>
  );
}
