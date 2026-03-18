import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: roles } = await supabase
    .from("profile_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin", "teacher"])
    .eq("is_active", true);

  const userIds = [...new Set((roles ?? []).map((r) => r.user_id))];

  if (userIds.length === 0) {
    return Response.json({
      senders: [{ id: "studio", name: "Ballet Academy and Movement" }],
    });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);

  const staffSenders = (profiles ?? []).map((p) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
  }));

  // Sort by name
  staffSenders.sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({
    senders: [
      { id: "studio", name: "Ballet Academy and Movement" },
      ...staffSenders,
    ],
  });
}
