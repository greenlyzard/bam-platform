import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroupFeedClient } from "./group-feed-client";
import { MemberSidebar } from "./member-sidebar";

const GROUP_TYPE_LABEL: Record<string, string> = {
  class: "Class",
  production: "Production",
  privates: "Privates",
  private_session: "Private session",
  studio_wide: "Studio-wide",
  custom: "Custom",
};

const CHAT_MODE_LABEL: Record<string, string> = {
  broadcast: "Broadcast",
  two_way: "Two-Way",
  disabled: "Disabled",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const sec = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id: groupId } = await params;
  const supabase = createAdminClient();

  const { data: group } = await supabase
    .from("communication_groups")
    .select("id, name, group_type, chat_mode, description, tenant_id")
    .eq("id", groupId)
    .single();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("communication_group_members")
    .select("id, user_id, role")
    .eq("group_id", groupId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", memberIds)
    : { data: [] };

  const profileMap = new Map<string, { name: string; avatar: string | null }>();
  for (const p of memberProfiles ?? []) {
    profileMap.set(p.id, {
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Member",
      avatar: p.avatar_url,
    });
  }
  const memberList = (members ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    name: profileMap.get(m.user_id)?.name ?? "Member",
    avatar: profileMap.get(m.user_id)?.avatar ?? null,
  }));

  const { data: posts } = await supabase
    .from("group_posts")
    .select("id, author_id, post_type, content, metadata, view_count, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  // Author profiles for posts
  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const { data: authorProfiles } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, role")
        .in("id", authorIds)
    : { data: [] };
  const authorMap = new Map<string, { name: string; avatar: string | null; role: string | null }>();
  for (const p of authorProfiles ?? []) {
    authorMap.set(p.id, {
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Staff",
      avatar: p.avatar_url,
      role: p.role,
    });
  }

  // Reactions for posts
  const postIds = (posts ?? []).map((p) => p.id);
  const { data: reactions } = postIds.length
    ? await supabase
        .from("group_post_reactions")
        .select("post_id, emoji, user_id")
        .in("post_id", postIds)
    : { data: [] };

  const reactionsByPost: Record<string, Record<string, { count: number; mine: boolean }>> = {};
  for (const r of reactions ?? []) {
    if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = {};
    const bucket = reactionsByPost[r.post_id];
    if (!bucket[r.emoji]) bucket[r.emoji] = { count: 0, mine: false };
    bucket[r.emoji].count++;
    if (r.user_id === user.id) bucket[r.emoji].mine = true;
  }

  const postList = (posts ?? []).map((p) => {
    const author = authorMap.get(p.author_id);
    return {
      id: p.id,
      post_type: p.post_type,
      content: p.content,
      metadata: (p.metadata ?? {}) as Record<string, unknown>,
      view_count: p.view_count ?? 0,
      created_at: p.created_at,
      created_at_label: formatRelative(p.created_at),
      author_name: author?.name ?? "Staff",
      author_avatar: author?.avatar ?? null,
      author_role: author?.role ?? null,
      reactions: reactionsByPost[p.id] ?? {},
    };
  });

  return (
    <div className="flex h-full flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-silver pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold text-charcoal">
                {group.name}
              </h1>
              <span className="rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-semibold text-lavender-dark">
                {GROUP_TYPE_LABEL[group.group_type] ?? group.group_type}
              </span>
              <span className="rounded-full border border-silver px-2 py-0.5 text-xs font-semibold text-slate">
                {CHAT_MODE_LABEL[group.chat_mode] ?? group.chat_mode}
              </span>
            </div>
            {group.description && (
              <p className="mt-1 text-sm text-slate">{group.description}</p>
            )}
            <p className="mt-1 text-xs text-mist">{memberList.length} members</p>
          </div>
          <Link
            href={`/admin/communications/groups`}
            className="rounded-lg border border-silver px-3 py-1.5 text-xs font-semibold text-slate hover:bg-cloud"
          >
            Settings
          </Link>
        </div>

        {/* Feed + Compose */}
        <GroupFeedClient
          groupId={groupId}
          posts={postList}
          chatMode={group.chat_mode}
        />
      </div>

      {/* Member sidebar */}
      <aside className="w-full shrink-0 lg:w-72">
        <MemberSidebar groupId={groupId} members={memberList} />
      </aside>
    </div>
  );
}
