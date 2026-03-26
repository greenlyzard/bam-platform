import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { LevelUpClient } from "./level-up-client";

export const metadata = { title: "Level Up Requests — Admin" };

export default async function LevelUpRequestsPage() {
  const user = await requireAdmin();
  const tenantId = user.tenantId ?? "84d98f72-c82f-414f-8b17-172b802f6993";

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("level_up_requests")
    .select(
      `id, status, created_at, notes,
       students!inner(id, first_name, last_name),
       current_class:classes!level_up_requests_current_class_id_fkey(id, name),
       requested_class:classes!level_up_requests_requested_class_id_fkey(id, name),
       requested_by:profiles!level_up_requests_requested_by_fkey(first_name, last_name)`
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LevelUpClient requests={(requests ?? []).map((r: any) => ({
        ...r,
        students: Array.isArray(r.students) ? r.students[0] : r.students,
        current_class: Array.isArray(r.current_class) ? r.current_class[0] : r.current_class,
        requested_class: Array.isArray(r.requested_class) ? r.requested_class[0] : r.requested_class,
        requested_by: Array.isArray(r.requested_by) ? r.requested_by[0] : r.requested_by,
      }))} />
    </div>
  );
}
