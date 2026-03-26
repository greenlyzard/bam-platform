import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { IconsClient } from "./icons-client";

export default async function IconLibraryPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: icons } = await supabase
    .from("icon_library")
    .select("*")
    .order("category")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-charcoal">Icon Library</h1>
        <p className="text-sm text-mist mt-1">
          Manage icons used across teacher profiles, disciplines, and affiliations.
        </p>
      </div>

      <IconsClient icons={icons ?? []} tenantId={user.tenantId!} />
    </div>
  );
}
