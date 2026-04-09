import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { ChatModeToggle } from "./ChatModeToggle";
import { CreateGroupButton } from "./CreateGroupButton";

type GroupRow = Pick<
  Database["public"]["Tables"]["communication_groups"]["Row"],
  "id" | "name" | "group_type" | "chat_mode" | "is_active" | "created_at"
>;

const GROUP_TYPE_LABEL: Record<string, string> = {
  class: "Class",
  production: "Production",
  privates: "Privates",
  private_session: "Private session",
  studio_wide: "Studio-wide",
  custom: "Custom",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(1, Math.round((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function CommunicationGroupsPage() {
  const user = await requireAdmin();
  // Spec: admin and super_admin only
  if (!["admin", "super_admin"].includes(user.role)) {
    redirect("/admin");
  }

  const supabase = await createClient();

  // Resolve tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  // Fetch groups
  const { data: groupsData } = await supabase
    .from("communication_groups")
    .select("id, name, group_type, chat_mode, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const groups: GroupRow[] = groupsData ?? [];
  const groupIds = groups.map((g) => g.id);

  // Member counts (one query, group_id list)
  const memberCounts: Record<string, number> = {};
  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from("communication_group_members")
      .select("group_id")
      .in("group_id", groupIds);
    for (const m of members ?? []) {
      memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
    }
  }

  // Last activity per group (most recent group_post)
  const lastActivity: Record<string, string> = {};
  if (groupIds.length > 0) {
    const { data: posts } = await supabase
      .from("group_posts")
      .select("group_id, created_at")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false });
    for (const p of posts ?? []) {
      if (p.created_at && !lastActivity[p.group_id]) {
        lastActivity[p.group_id] = p.created_at;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Communication Groups
          </h1>
          <p className="mt-1 text-sm text-slate">
            Every class, production, and custom group — chat mode, members,
            and last activity.
          </p>
        </div>
        <CreateGroupButton />
      </div>

      <div className="overflow-hidden rounded-lg border border-silver bg-white">
        <table className="min-w-full divide-y divide-silver text-sm">
          <thead className="bg-cloud text-left text-xs font-semibold uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Chat Mode</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silver">
            {groups.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate"
                >
                  No groups yet.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="hover:bg-cloud/50">
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {g.name}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {GROUP_TYPE_LABEL[g.group_type] ?? g.group_type}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {memberCounts[g.id] ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <ChatModeToggle
                      groupId={g.id}
                      value={g.chat_mode as "broadcast" | "two_way" | "disabled"}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {formatRelative(lastActivity[g.id] ?? null)}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {g.is_active === false ? "Archived" : "Active"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
