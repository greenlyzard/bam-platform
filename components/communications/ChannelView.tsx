"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_archived: boolean;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  sender_name: string;
  content: string;
  message_type: string;
  is_own: boolean;
  edited_at: string | null;
  created_at: string;
}

interface ChannelMember {
  id: string;
  profile_id: string;
  role: string;
  name: string;
  email: string | null;
  is_muted: boolean;
  joined_at: string;
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  tenant_role: string;
}

// ── Type Labels ───────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  class_group: "Class",
  production_group: "Production",
  admin_group: "Admin",
  parent_group: "Parent",
  student_group: "Student",
  direct_message: "DM",
  announcement: "Announce",
  general: "General",
};

const TYPE_ICONS: Record<string, string> = {
  class_group: "📚",
  production_group: "🎭",
  admin_group: "🔒",
  parent_group: "👨‍👩‍👧",
  student_group: "🩰",
  direct_message: "💬",
  announcement: "📢",
  general: "💬",
};

// ── Main Component ────────────────────────────────────────────

export function ChannelView({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);

    const res = await fetch(`/api/communications/channels?${params}`);
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels ?? []);
    }
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Poll for new messages every 10s when a channel is selected
  useEffect(() => {
    if (!selectedChannel) return;
    const interval = setInterval(async () => {
      const res = await fetch(
        `/api/communications/channels/${selectedChannel.id}/messages`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedChannel]);

  async function openChannel(channel: Channel) {
    setSelectedChannel(channel);
    setMobilePanel("chat");
    setMsgLoading(true);

    const [msgRes, detailRes] = await Promise.all([
      fetch(`/api/communications/channels/${channel.id}/messages`),
      fetch(`/api/communications/channels/${channel.id}`),
    ]);

    if (msgRes.ok) {
      const data = await msgRes.json();
      setMessages(data.messages ?? []);
    }
    if (detailRes.ok) {
      const data = await detailRes.json();
      setMembers(data.members ?? []);
    }

    // Clear unread in local state
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id ? { ...c, unread_count: 0 } : c
      )
    );
    setMsgLoading(false);
  }

  async function handleSendMessage(content: string) {
    if (!selectedChannel) return;

    const res = await fetch(
      `/api/communications/channels/${selectedChannel.id}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );

    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === selectedChannel.id
            ? { ...c, last_message_at: msg.created_at }
            : c
        )
      );
    }
  }

  function handleCreateSuccess() {
    setShowCreate(false);
    fetchChannels();
  }

  const filteredChannels = channels;
  const totalUnread = channels.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="h-[calc(100vh-14rem)] flex rounded-xl border border-silver bg-white overflow-hidden">
      {/* Left: Channel Sidebar */}
      <div
        className={`w-64 shrink-0 flex flex-col border-r border-silver bg-cloud/30 ${
          mobilePanel === "chat" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-3 border-b border-silver">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-charcoal">
              Channels
              {totalUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-lavender px-1.5 text-xs font-semibold text-white">
                  {totalUnread}
                </span>
              )}
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-md bg-lavender px-2.5 py-1 text-xs font-semibold text-white hover:bg-lavender-dark transition-colors"
              >
                + New
              </button>
            )}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-silver px-2 py-1.5 text-xs bg-white"
          >
            <option value="all">All Types</option>
            <option value="class_group">Class Groups</option>
            <option value="production_group">Production Groups</option>
            <option value="admin_group">Admin Groups</option>
            <option value="direct_message">Direct Messages</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* Channel List */}
        <nav className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-mist">Loading...</div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-4 text-center text-xs text-mist">
              No channels found.
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                isSelected={selectedChannel?.id === channel.id}
                onClick={() => openChannel(channel)}
              />
            ))
          )}
        </nav>
      </div>

      {/* Right: Chat View */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${
          mobilePanel === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedChannel ? (
          <ChatView
            channel={selectedChannel}
            messages={messages}
            members={members}
            userId={userId}
            isAdmin={isAdmin}
            loading={msgLoading}
            onSend={handleSendMessage}
            onBack={() => setMobilePanel("list")}
            onMembersChanged={async () => {
              const res = await fetch(
                `/api/communications/channels/${selectedChannel.id}`
              );
              if (res.ok) {
                const data = await res.json();
                setMembers(data.members ?? []);
              }
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl text-lavender/40">💬</span>
              <p className="mt-3 text-sm text-mist">
                Select a channel to start chatting
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}

// ── Channel Row ───────────────────────────────────────────────

function ChannelRow({
  channel,
  isSelected,
  onClick,
}: {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasUnread = channel.unread_count > 0;
  const icon = TYPE_ICONS[channel.type] ?? "💬";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-silver/30 transition-colors ${
        isSelected
          ? "bg-lavender/10"
          : "hover:bg-cloud/50"
      } ${hasUnread ? "border-l-2 border-l-lavender" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-sm truncate ${
                hasUnread
                  ? "font-semibold text-charcoal"
                  : "font-medium text-slate"
              }`}
            >
              {channel.name}
            </span>
            {hasUnread && (
              <span className="inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-lavender px-1 text-[10px] font-bold text-white shrink-0">
                {channel.unread_count}
              </span>
            )}
          </div>
          <span className="text-[10px] text-mist uppercase tracking-wide">
            {TYPE_LABELS[channel.type] ?? channel.type}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Chat View ─────────────────────────────────────────────────

function ChatView({
  channel,
  messages,
  members,
  userId,
  isAdmin,
  loading,
  onSend,
  onBack,
  onMembersChanged,
}: {
  channel: Channel;
  messages: ChannelMessage[];
  members: ChannelMember[];
  userId: string;
  isAdmin: boolean;
  loading: boolean;
  onSend: (content: string) => void;
  onBack: () => void;
  onMembersChanged: () => void;
}) {
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Can current user manage members? (admin or channel owner/admin)
  const currentMembership = members.find((m) => m.profile_id === userId);
  const canManage =
    isAdmin || currentMembership?.role === "owner" || currentMembership?.role === "admin";

  return (
    <div className="flex h-full relative">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="shrink-0 border-b border-silver px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="md:hidden text-sm text-lavender mr-1"
            >
              ← Back
            </button>
            <span className="text-lg">{TYPE_ICONS[channel.type] ?? "💬"}</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-charcoal truncate">
                {channel.name}
              </h2>
              {channel.description && (
                <p className="text-xs text-mist truncate">{channel.description}</p>
              )}
            </div>
            <span className="text-[10px] rounded-full bg-lavender/10 px-2 py-0.5 text-lavender-dark font-medium uppercase">
              {TYPE_LABELS[channel.type] ?? channel.type}
            </span>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                showMembers
                  ? "border-lavender bg-lavender/10 text-lavender-dark"
                  : "border-silver text-slate hover:bg-cloud"
              }`}
            >
              {members.length} members
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-sm text-mist py-8">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-mist py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <MessageInput onSend={onSend} />
      </div>

      {/* Members slide-out panel */}
      {showMembers && (
        <MemberPanel
          channelId={channel.id}
          members={members}
          canManage={canManage}
          onClose={() => setShowMembers(false)}
          onChanged={onMembersChanged}
        />
      )}
    </div>
  );
}

// ── Chat Bubble ───────────────────────────────────────────────

function ChatBubble({ message }: { message: ChannelMessage }) {
  const isSystem = message.message_type === "system";
  const timeStr = new Date(message.created_at).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-mist bg-cloud/50 rounded-full px-3 py-1">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${message.is_own ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
          message.is_own
            ? "bg-gold/10 text-gold-dark"
            : "bg-lavender/10 text-lavender"
        }`}
      >
        {(message.sender_name[0] ?? "?").toUpperCase()}
      </div>

      <div className={`max-w-[75%] ${message.is_own ? "text-right" : ""}`}>
        <div
          className={`flex items-center gap-2 mb-0.5 ${
            message.is_own ? "justify-end" : ""
          }`}
        >
          <span className="text-xs font-medium text-charcoal">
            {message.sender_name}
          </span>
          <span className="text-[10px] text-mist">{timeStr}</span>
          {message.edited_at && (
            <span className="text-[10px] text-mist">(edited)</span>
          )}
        </div>
        <div
          className={`rounded-xl px-3.5 py-2 text-sm ${
            message.is_own
              ? "bg-lavender text-white rounded-tr-sm"
              : "bg-cloud text-charcoal rounded-tl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

// ── Message Input ─────────────────────────────────────────────

function MessageInput({ onSend }: { onSend: (content: string) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    await onSend(text.trim());
    setText("");
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 border-t border-silver p-3">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 rounded-lg border border-silver px-3 py-2 text-sm resize-none focus:outline-none focus:border-lavender focus:ring-1 focus:ring-lavender"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="rounded-lg bg-lavender px-4 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50 shrink-0"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      <p className="text-[10px] text-mist mt-1">
        Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

// ── Member Panel (slide-out) ──────────────────────────────────

function MemberPanel({
  channelId,
  members,
  canManage,
  onClose,
  onChanged,
}: {
  channelId: string;
  members: ChannelMember[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (search.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/communications/channels/${channelId}/members?search=${encodeURIComponent(search.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
      }
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, channelId]);

  async function addMember(profileId: string) {
    setAdding(profileId);
    const res = await fetch(
      `/api/communications/channels/${channelId}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId }),
      }
    );
    if (res.ok) {
      setSearch("");
      setSearchResults([]);
      onChanged();
    }
    setAdding(null);
  }

  async function removeMember(profileId: string) {
    setRemoving(profileId);
    const res = await fetch(
      `/api/communications/channels/${channelId}/members`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId }),
      }
    );
    if (res.ok) {
      onChanged();
    }
    setRemoving(null);
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
  };

  const ROLE_STYLES: Record<string, string> = {
    owner: "bg-gold/10 text-gold-dark",
    admin: "bg-lavender/10 text-lavender-dark",
    member: "bg-cloud text-mist",
  };

  return (
    <div className="w-72 shrink-0 border-l border-silver bg-white flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="shrink-0 px-4 py-3 border-b border-silver flex items-center justify-between">
        <h3 className="text-sm font-semibold text-charcoal">Members</h3>
        <button
          onClick={onClose}
          className="text-mist hover:text-charcoal text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Search to add */}
      {canManage && (
        <div className="shrink-0 px-4 py-3 border-b border-silver">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users to add..."
            className="w-full rounded-lg border border-silver px-3 py-1.5 text-xs focus:outline-none focus:border-lavender focus:ring-1 focus:ring-lavender"
          />
          {/* Search results dropdown */}
          {(searching || searchResults.length > 0) && search.trim().length >= 2 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-silver bg-white shadow-sm">
              {searching ? (
                <div className="px-3 py-2 text-xs text-mist">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-2 text-xs text-mist">No users found</div>
              ) : (
                searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-cloud/50 border-b border-silver/30 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-charcoal truncate">
                        {r.name}
                      </p>
                      <p className="text-[10px] text-mist truncate">
                        {r.tenant_role} {r.email ? `· ${r.email}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => addMember(r.id)}
                      disabled={adding === r.id}
                      className="shrink-0 rounded bg-lavender px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
                    >
                      {adding === r.id ? "..." : "Add"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Current members list */}
      <div className="flex-1 overflow-y-auto">
        {members.map((m) => (
          <div
            key={m.profile_id}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-silver/30 hover:bg-cloud/30"
          >
            {/* Avatar */}
            <div className="shrink-0 w-7 h-7 rounded-full bg-lavender/10 flex items-center justify-center text-xs font-semibold text-lavender">
              {(m.name[0] ?? "?").toUpperCase()}
            </div>

            {/* Name + role */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-charcoal truncate">
                {m.name}
              </p>
              <span
                className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  ROLE_STYLES[m.role] ?? ROLE_STYLES.member
                }`}
              >
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </div>

            {/* Remove button */}
            {canManage && m.role !== "owner" && (
              <button
                onClick={() => removeMember(m.profile_id)}
                disabled={removing === m.profile_id}
                className="shrink-0 rounded border border-silver px-1.5 py-0.5 text-[10px] text-mist hover:text-error hover:border-error/30 transition-colors disabled:opacity-50"
                title="Remove member"
              >
                {removing === m.profile_id ? "..." : "×"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer count */}
      <div className="shrink-0 px-4 py-2 border-t border-silver bg-cloud/20">
        <p className="text-[10px] text-mist text-center">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

// ── Create Channel Modal ──────────────────────────────────────

function CreateChannelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError("");

    const res = await fetch("/api/communications/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        type,
      }),
    });

    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create channel");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-silver px-5 py-4">
          <h2 className="text-base font-heading font-semibold text-charcoal">
            Create Channel
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nutcracker Cast A"
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm bg-white"
            >
              <option value="general">General</option>
              <option value="class_group">Class Group</option>
              <option value="production_group">Production Group</option>
              <option value="admin_group">Admin Group</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel for?"
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-silver px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-silver px-4 py-2 text-sm text-slate hover:bg-cloud transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-lavender px-4 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
