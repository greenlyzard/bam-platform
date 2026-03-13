"use client";

import { useState, useEffect, useCallback } from "react";
import { ComposeModal } from "./ComposeModal";

// ── Types ─────────────────────────────────────────────────────

interface Thread {
  id: string;
  thread_token: string;
  subject: string | null;
  thread_type: string;
  state: string;
  priority: string;
  contact_name: string | null;
  contact_email: string | null;
  family_id: string | null;
  lead_id: string | null;
  staff_user_id: string | null;
  assigned_to: string | null;
  unread_count: number;
  message_count: number;
  last_message_at: string;
  last_message?: {
    preview: string;
    direction: string;
    sender_name: string | null;
    created_at: string;
  } | null;
}

interface Message {
  id: string;
  thread_id: string;
  direction: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  matched: boolean;
  template_slug: string | null;
  created_at: string;
}

interface CurrentUser {
  id: string;
  role: string;
  name: string;
  email: string;
}

interface StaffMember {
  id: string;
  name: string;
}

// ── Folder Config ─────────────────────────────────────────────

interface Folder {
  key: string;
  label: string;
  filter: Record<string, string>;
  adminOnly?: boolean;
}

const FOLDERS: Folder[] = [
  { key: "all", label: "All Messages", filter: { state: "all" } },
  { key: "unread", label: "Unread", filter: { state: "open" } },
  { key: "flagged", label: "Flagged", filter: { priority: "flagged" } },
  { key: "mine", label: "Assigned to Me", filter: {} },
  { key: "unmatched", label: "Unmatched", filter: {}, adminOnly: true },
  { key: "_divider", label: "", filter: {} },
  { key: "families", label: "Families", filter: { state: "all" } },
  { key: "leads", label: "Leads", filter: { state: "all" } },
  { key: "staff", label: "Staff", filter: { state: "all" } },
  { key: "system", label: "System", filter: { state: "all" } },
];

// ── Main Component ────────────────────────────────────────────

export function InboxLayout({
  currentUser,
  staffList,
}: {
  currentUser: CurrentUser;
  staffList: StaffMember[];
}) {
  const [activeFolder, setActiveFolder] = useState("all");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"list" | "detail">("list");

  const isAdmin = ["super_admin", "admin"].includes(currentUser.role);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const folder = FOLDERS.find((f) => f.key === activeFolder);
    const params = new URLSearchParams();

    if (folder) {
      for (const [k, v] of Object.entries(folder.filter)) {
        params.set(k, v);
      }
    }

    // Special folder logic
    if (activeFolder === "mine") {
      params.set("assigned_to", currentUser.id);
      params.set("state", "all");
    } else if (activeFolder === "unmatched") {
      params.set("unmatched", "true");
      params.set("state", "all");
    } else if (activeFolder === "families") {
      // Will filter client-side
      params.set("state", "all");
    } else if (activeFolder === "leads") {
      params.set("state", "all");
    } else if (activeFolder === "staff") {
      params.set("state", "all");
    } else if (activeFolder === "system") {
      params.set("type", "system");
    }

    const res = await fetch(`/api/communications/threads?${params}`);
    if (res.ok) {
      const data = await res.json();
      let filtered = data.threads as Thread[];

      // Client-side folder filtering
      if (activeFolder === "families") {
        filtered = filtered.filter((t) => t.family_id);
      } else if (activeFolder === "leads") {
        filtered = filtered.filter((t) => t.lead_id);
      } else if (activeFolder === "staff") {
        filtered = filtered.filter((t) => t.staff_user_id);
      } else if (activeFolder === "unread") {
        filtered = filtered.filter((t) => t.unread_count > 0);
      }

      setThreads(filtered);
    }
    setLoading(false);
  }, [activeFolder, currentUser.id]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  async function openThread(thread: Thread) {
    setSelectedThread(thread);
    setMobilePanel("detail");

    const res = await fetch(`/api/communications/threads/${thread.id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      // Mark as read in local state
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id ? { ...t, unread_count: 0 } : t
        )
      );
    }
  }

  async function updateThread(
    threadId: string,
    updates: Record<string, unknown>
  ) {
    await fetch(`/api/communications/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, ...updates } : t
      )
    );
    if (selectedThread?.id === threadId) {
      setSelectedThread((prev) =>
        prev ? { ...prev, ...(updates as Partial<Thread>) } : null
      );
    }
  }

  async function sendReply(bodyHtml: string) {
    if (!selectedThread) return;

    await fetch(
      `/api/communications/threads/${selectedThread.id}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_html: bodyHtml }),
      }
    );

    // Refresh messages
    const res = await fetch(
      `/api/communications/threads/${selectedThread.id}`
    );
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
    }
  }

  function handleComposeSuccess() {
    setShowCompose(false);
    fetchThreads();
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex rounded-xl border border-silver bg-white overflow-hidden">
      {/* Left: Folder Sidebar (hidden on mobile) */}
      <div className="hidden md:flex w-48 shrink-0 flex-col border-r border-silver bg-cloud/30">
        <div className="p-3">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full rounded-lg bg-lavender px-3 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
          >
            New Message
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {FOLDERS.filter(
            (f) => !f.adminOnly || isAdmin
          ).map((folder) => {
            if (folder.key === "_divider") {
              return (
                <div
                  key={folder.key}
                  className="my-2 border-t border-silver"
                />
              );
            }
            const isActive = activeFolder === folder.key;
            const count =
              folder.key === "unread"
                ? threads.filter((t) => t.unread_count > 0).length
                : 0;

            return (
              <button
                key={folder.key}
                onClick={() => {
                  setActiveFolder(folder.key);
                  setSelectedThread(null);
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-lavender/10 text-lavender-dark font-medium"
                    : "text-slate hover:bg-cloud hover:text-charcoal"
                }`}
              >
                {folder.label}
                {count > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-lavender px-1.5 text-xs font-semibold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Center: Thread List */}
      <div
        className={`flex-1 min-w-0 flex flex-col border-r border-silver ${
          mobilePanel === "detail" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-silver">
          <select
            value={activeFolder}
            onChange={(e) => {
              setActiveFolder(e.target.value);
              setSelectedThread(null);
            }}
            className="rounded-lg border border-silver px-3 py-1.5 text-sm bg-white"
          >
            {FOLDERS.filter((f) => f.key !== "_divider" && (!f.adminOnly || isAdmin)).map(
              (f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              )
            )}
          </select>
          <button
            onClick={() => setShowCompose(true)}
            className="rounded-lg bg-lavender px-3 py-1.5 text-sm font-semibold text-white"
          >
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-mist">
              Loading...
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-sm text-mist">
              No conversations found.
            </div>
          ) : (
            threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                isSelected={selectedThread?.id === thread.id}
                onClick={() => openThread(thread)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Thread Detail */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${
          mobilePanel === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedThread ? (
          <ThreadDetail
            thread={selectedThread}
            messages={messages}
            currentUser={currentUser}
            staffList={staffList}
            isAdmin={isAdmin}
            onUpdate={updateThread}
            onReply={sendReply}
            onBack={() => setMobilePanel("list")}
            onRefreshMessages={async () => {
              const res = await fetch(`/api/communications/threads/${selectedThread.id}`);
              if (res.ok) {
                const data = await res.json();
                setMessages(data.messages);
              }
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl text-lavender/40">✉</span>
              <p className="mt-3 text-sm text-mist">
                Select a conversation to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSuccess={handleComposeSuccess}
        />
      )}
    </div>
  );
}

// ── Thread Row ────────────────────────────────────────────────

function ThreadRow({
  thread,
  isSelected,
  onClick,
}: {
  thread: Thread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isUnread = thread.unread_count > 0;
  const timeStr = formatRelativeTime(thread.last_message_at);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-silver/50 transition-colors ${
        isSelected
          ? "bg-lavender/5"
          : "hover:bg-cloud/50"
      } ${isUnread ? "border-l-2 border-l-lavender" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-lavender/10 flex items-center justify-center text-sm font-semibold text-lavender">
          {(thread.contact_name?.[0] ?? "?").toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm truncate ${
                isUnread
                  ? "font-semibold text-charcoal"
                  : "font-medium text-slate"
              }`}
            >
              {thread.contact_name ?? thread.contact_email ?? "Unknown"}
            </span>
            <span className="text-xs text-mist shrink-0">{timeStr}</span>
          </div>

          {thread.subject && (
            <p className="text-xs font-medium text-charcoal truncate mt-0.5">
              {thread.subject}
            </p>
          )}

          <p className="text-xs text-mist truncate mt-0.5">
            {thread.last_message?.preview ?? "No messages yet"}
          </p>

          <div className="flex items-center gap-2 mt-1">
            {thread.priority === "flagged" && (
              <span className="text-xs text-warning">⚑</span>
            )}
            {thread.priority === "urgent" && (
              <span className="text-xs text-error">⚑</span>
            )}
            {isUnread && (
              <span className="inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-lavender px-1 text-[10px] font-bold text-white">
                {thread.unread_count}
              </span>
            )}
            <StateBadge state={thread.state} small />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Thread Detail ─────────────────────────────────────────────

function ThreadDetail({
  thread,
  messages,
  currentUser,
  staffList,
  isAdmin,
  onUpdate,
  onReply,
  onBack,
  onRefreshMessages,
}: {
  thread: Thread;
  messages: Message[];
  currentUser: CurrentUser;
  staffList: StaffMember[];
  isAdmin: boolean;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onReply: (bodyHtml: string) => void;
  onBack: () => void;
  onRefreshMessages?: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showActions, setShowActions] = useState(false);

  async function handleSend() {
    if (!replyText.trim()) return;
    setSending(true);
    // Wrap plain text in paragraph tags
    const html = replyText
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join("");
    await onReply(html);
    setReplyText("");
    setSending(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-silver px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onBack}
            className="md:hidden text-sm text-lavender mr-1"
          >
            ← Back
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-charcoal truncate">
              {thread.contact_name ?? thread.contact_email ?? "Unknown"}
            </h2>
            {thread.contact_email && (
              <p className="text-xs text-mist">{thread.contact_email}</p>
            )}
          </div>
          <StateBadge state={thread.state} />
          {thread.priority !== "normal" && (
            <PriorityBadge priority={thread.priority} />
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Assign dropdown */}
            <select
              value={thread.assigned_to ?? ""}
              onChange={(e) =>
                onUpdate(thread.id, {
                  assigned_to: e.target.value || null,
                })
              }
              className="rounded-md border border-silver px-2 py-1 text-xs bg-white"
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="rounded-md border border-silver px-2 py-1 text-xs text-slate hover:bg-cloud"
              >
                Actions ▾
              </button>
              {showActions && (
                <div className="absolute right-0 mt-1 w-40 rounded-lg border border-silver bg-white shadow-lg z-10">
                  <button
                    onClick={() => {
                      onUpdate(thread.id, { state: "resolved" });
                      setShowActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate hover:bg-cloud"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => {
                      onUpdate(thread.id, { state: "archived" });
                      setShowActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate hover:bg-cloud"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => {
                      onUpdate(thread.id, { state: "spam" });
                      setShowActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-error hover:bg-cloud"
                  >
                    Mark Spam
                  </button>
                  <div className="border-t border-silver" />
                  <button
                    onClick={() => {
                      onUpdate(thread.id, {
                        priority:
                          thread.priority === "flagged"
                            ? "normal"
                            : "flagged",
                      });
                      setShowActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate hover:bg-cloud"
                  >
                    {thread.priority === "flagged" ? "Unflag" : "Flag"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === currentUser.id}
            isAdmin={isAdmin}
            onMatched={onRefreshMessages}
          />
        ))}
      </div>

      {/* Compose */}
      <div className="shrink-0 border-t border-silver p-3">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Type your reply..."
          rows={3}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm resize-none focus:outline-none focus:border-lavender"
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={handleSend}
            disabled={sending || !replyText.trim()}
            className="rounded-lg bg-lavender px-4 py-1.5 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  isAdmin,
  onMatched,
}: {
  message: Message;
  isOwn: boolean;
  isAdmin?: boolean;
  onMatched?: () => void;
}) {
  const isSystem = message.direction === "system";
  const isInbound = message.direction === "inbound";
  const timeStr = new Date(message.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={`${
        isSystem
          ? "bg-cloud/50 rounded-lg p-3"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
            isInbound
              ? "bg-lavender/10 text-lavender"
              : isSystem
              ? "bg-cloud text-mist"
              : "bg-gold/10 text-gold-dark"
          }`}
        >
          {(message.sender_name?.[0] ?? "?").toUpperCase()}
        </div>
        <span className="text-xs font-medium text-charcoal">
          {message.sender_name ?? message.sender_email ?? "System"}
        </span>
        <span className="text-xs text-mist">
          {isInbound ? "←" : isSystem ? "•" : "→"}
        </span>
        <span className="text-xs text-mist">{timeStr}</span>
        {message.template_slug && (
          <span className="text-[10px] bg-cloud text-mist px-1.5 py-0.5 rounded-full">
            {message.template_slug}
          </span>
        )}
      </div>
      {message.body_html ? (
        <div
          className="text-sm text-charcoal prose prose-sm max-w-none pl-8"
          dangerouslySetInnerHTML={{ __html: message.body_html }}
        />
      ) : message.body_text ? (
        <p className="text-sm text-charcoal pl-8 whitespace-pre-wrap">
          {message.body_text}
        </p>
      ) : null}

      {/* Unmatched message banner */}
      {isAdmin && isInbound && !message.matched && (
        <MatchBanner messageId={message.id} senderName={message.sender_name} senderEmail={message.sender_email} onMatched={onMatched} />
      )}
    </div>
  );
}

// ── Match Banner ─────────────────────────────────────────────

function MatchBanner({
  messageId,
  senderName,
  senderEmail,
  onMatched,
}: {
  messageId: string;
  senderName: string | null;
  senderEmail: string | null;
  onMatched?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; email: string; type: string }[]>([]);
  const [saving, setSaving] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/communications/contacts/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.contacts ?? []);
      }
    } catch {
      // ignore
    }
  }

  async function matchTo(contact: { id: string; type: string }) {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    if (contact.type === "family") payload.family_id = contact.id;
    if (contact.type === "lead") payload.lead_id = contact.id;
    if (contact.type === "staff") payload.staff_user_id = contact.id;

    await fetch(`/api/communications/messages/${messageId}/match`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    onMatched?.();
  }

  async function createLead() {
    setSaving(true);
    await fetch(`/api/communications/messages/${messageId}/match`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        create_lead: true,
        sender_name: senderName,
        sender_email: senderEmail,
      }),
    });
    setSaving(false);
    onMatched?.();
  }

  if (!expanded) {
    return (
      <div className="ml-8 mt-2">
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-warning hover:text-warning/80 bg-warning/10 rounded px-2 py-1"
        >
          ⚠ Unmatched sender — click to link to a contact
        </button>
      </div>
    );
  }

  return (
    <div className="ml-8 mt-2 rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
      <p className="text-xs font-medium text-charcoal">
        Link this sender to a contact:
      </p>
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search families, leads, staff..."
        className="w-full rounded border border-silver px-2 py-1.5 text-xs focus:border-lavender focus:outline-none"
      />
      {results.length > 0 && (
        <div className="max-h-32 overflow-y-auto divide-y divide-silver/50">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => matchTo(r)}
              disabled={saving}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-cloud/50 text-xs disabled:opacity-50"
            >
              <span className="font-medium text-charcoal">{r.name}</span>
              <span className="text-mist">{r.email}</span>
              <span className="ml-auto rounded bg-cloud px-1.5 py-0.5 text-[10px] uppercase text-mist">
                {r.type}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={createLead}
          disabled={saving}
          className="text-xs text-lavender hover:text-lavender-dark disabled:opacity-50"
        >
          + Create as new lead
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-mist hover:text-slate ml-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────

function StateBadge({
  state,
  small,
}: {
  state: string;
  small?: boolean;
}) {
  const styles: Record<string, string> = {
    open: "bg-success/10 text-success",
    resolved: "bg-cloud text-mist",
    archived: "bg-cloud text-mist",
    spam: "bg-error/10 text-error",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${
        styles[state] ?? styles.open
      } ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
    >
      {state}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "flagged") {
    return (
      <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        ⚑ Flagged
      </span>
    );
  }
  if (priority === "urgent") {
    return (
      <span className="inline-flex items-center rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
        ⚑ Urgent
      </span>
    );
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
