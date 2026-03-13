import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ModuleControlGrid } from "./ModuleControlGrid";

const SUPER_EMAIL = "derek@greenlyzard.com";

export default async function ModuleControlPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (profile?.email !== SUPER_EMAIL && profile?.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const { data: modules } = await supabase
    .from("platform_modules")
    .select("*")
    .order("nav_group")
    .order("sort_order");

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Module Control
        </h1>
        <p className="mt-1 text-sm text-mist">
          Enable, disable, and configure platform modules. Changes take effect
          immediately.
        </p>
      </div>
      <ModuleControlGrid initialModules={modules ?? []} />
    </div>
  );
}
