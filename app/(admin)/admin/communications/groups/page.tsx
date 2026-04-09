import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // Admin client bypasses RLS — safe here because the page is gated to
  // admin/super_admin above. Used for the communications-hub queries to
  // sidestep policy evaluation entirely on this admin-only surface.
  const admin = createAdminClient();

  // Resolve tenant (regular client is fine — tenants is publicly readable)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  // Fetch groups
  const { data: groupsData } = await admin
    .from("communication_groups")
    .select("id, name, group_type, chat_mode, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const groups: GroupRow[] = groupsData ?? [];
  const groupIds = groups.map((g) => g.id);

  // Member counts (one query, group_id list)
  const memberCounts: Record<string, number> = {};
  if (groupIds.length > 0) {
    const { data: members } = await admin
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
    const { data: posts } = await admin
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

  // Unified inbox: 10 most recent group posts across all groups
  const groupNameMap = new Map<string, string>();
  for (const g of groups) groupNameMap.set(g.id, g.name);

  const { data: recentPosts } = groupIds.length
    ? await admin
        .from("group_posts")
        .select("id, group_id, content, post_type, created_at, author_id")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  // 10 most recent direct-message threads where current user is participant
  const { data: dmThreads } = await admin
    .from("communication_threads")
    .select("id, subject, last_message_at, unread_count, created_by, staff_user_id")
    .eq("tenant_id", tenantId)
    .eq("thread_type", "direct")
    .eq("channel", "in_app")
    .or(`created_by.eq.${user.id},staff_user_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false })
    .limit(10);

  const otherIds = Array.from(
    new Set(
      (dmThreads ?? [])
        .map((t) => (t.created_by === user.id ? t.staff_user_id : t.created_by))
        .filter(Boolean) as string[]
    )
  );
  const { data: dmProfiles } = otherIds.length
    ? await admin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", otherIds)
    : { data: [] };
  const dmProfileMap = new Map<string, string>();
  for (const p of dmProfiles ?? []) {
    dmProfileMap.set(
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member"
    );
  }

  return (
    <div className="space-y-4 pb-24 md:space-y-6 md:pb-0">
      {/* Sticky mobile-friendly header */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-silver bg-cream/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold text-charcoal md:text-2xl">
            Communications
          </h1>
          <p className="hidden text-sm text-slate md:mt-1 md:block">
            Every class, production, and custom group — chat mode, members,
            and last activity.
          </p>
        </div>
        <CreateGroupButton />
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white/50 p-8 text-center text-sm text-slate">
            No groups yet.
          </div>
        ) : (
          groups.map((g) => (
            <Link
              key={g.id}
              href={`/admin/communications/groups/${g.id}`}
              className="block min-h-12 rounded-xl border border-silver bg-white p-4 active:bg-cloud"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-base font-semibold text-charcoal">
                  {g.name}
                </p>
                <span className="rounded-full bg-lavender/10 px-2 py-0.5 text-[11px] font-semibold text-lavender-dark">
                  {GROUP_TYPE_LABEL[g.group_type] ?? g.group_type}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate">
                <span>{memberCounts[g.id] ?? 0} members</span>
                <span>·</span>
                <span>{formatRelative(lastActivity[g.id] ?? null) || "no posts"}</span>
                <span>·</span>
                <span>{g.is_active === false ? "Archived" : "Active"}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Unified inbox + table — 2 col on desktop */}
      <div className="hidden gap-6 md:grid md:grid-cols-3">
      <div className="md:col-span-2 overflow-hidden rounded-lg border border-silver bg-white">
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
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate">
                  No groups yet.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="hover:bg-cloud/50">
                  <td className="px-4 py-3 font-medium text-charcoal">
                    <Link
                      href={`/admin/communications/groups/${g.id}`}
                      className="hover:text-lavender-dark"
                    >
                      {g.name}
                    </Link>
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

      {/* Unified inbox sidebar */}
      <aside className="space-y-5">
        <div className="rounded-xl border border-silver bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">
            Recent Group Posts
          </h2>
          {(recentPosts ?? []).length === 0 ? (
            <p className="text-xs text-mist">No posts yet.</p>
          ) : (
            <ul className="space-y-2">
              {(recentPosts ?? []).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/communications/groups/${p.group_id}`}
                    className="block rounded-lg p-2 hover:bg-cloud"
                  >
                    <p className="text-[11px] font-semibold uppercase text-lavender-dark">
                      {groupNameMap.get(p.group_id) ?? "Group"}
                    </p>
                    <p className="line-clamp-2 text-sm text-charcoal">
                      {p.content ?? `(${p.post_type})`}
                    </p>
                    <p className="text-[10px] text-mist">{formatRelative(p.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-silver bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">
            Direct Messages
          </h2>
          {(dmThreads ?? []).length === 0 ? (
            <p className="text-xs text-mist">No direct messages yet.</p>
          ) : (
            <ul className="space-y-1">
              {(dmThreads ?? []).map((t) => {
                const otherUserId =
                  t.created_by === user.id ? t.staff_user_id : t.created_by;
                const otherName = otherUserId
                  ? dmProfileMap.get(otherUserId) ?? "Member"
                  : "Member";
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg p-2 hover:bg-cloud"
                  >
                    <span className="truncate text-sm text-charcoal">{otherName}</span>
                    {t.unread_count > 0 && (
                      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lavender px-1.5 text-[10px] font-bold text-white">
                        {t.unread_count}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}
