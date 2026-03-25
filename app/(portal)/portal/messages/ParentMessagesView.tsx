"use client";

import { useState, useEffect } from "react";
import { MessageThread } from "@/components/communications/MessageThread";
import { SimpleSelect } from "@/components/ui/select";

interface Announcement {
  id: string;
  title: string;
  body_html: string;
  sent_at: string;
  is_read: boolean;
}

interface TeacherOption {
  id: string;
  name: string;
  class_name: string;
}

interface ThreadPreview {
  id: string;
  subject: string | null;
  participant_names: string[];
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
}

export function ParentMessagesView({
  announcements,
  teacherOptions,
  userId,
}: {
  announcements: Announcement[];
  teacherOptions: TeacherOption[];
  userId: string;
}) {
  const [tab, setTab] = useState<"announcements" | "conversations">(
    "announcements"
  );
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<
    string | null
  >(null);
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newRecipientId, setNewRecipientId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);

  async function loadThreads() {
    if (threadsLoaded) return;
    try {
      const res = await fetch("/api/communications/messages");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads ?? []);
      }
    } catch {
      // ignore
    }
    setThreadsLoaded(true);
  }

  useEffect(() => {
    if (tab === "conversations") loadThreads();
  }, [tab]);

  async function markAnnouncementRead(announcementId: string) {
    // Fire and forget — marks read via API
    try {
      await fetch("/api/communications/announcements/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement_id: announcementId }),
      });
    } catch {
      // ignore
    }
  }

  async function handleNewMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newRecipientId || !newBody.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/communications/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: newRecipientId,
          subject: newSubject.trim() || undefined,
          body: newBody.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowNewMessage(false);
        setNewRecipientId("");
        setNewSubject("");
        setNewBody("");
        setSelectedThread(data.thread_id);
        setThreadsLoaded(false);
      }
    } finally {
      setSending(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Thread view
  if (selectedThread) {
    return (
      <div className="bg-white rounded-xl border border-silver p-6 min-h-[400px] flex flex-col">
        <MessageThread
          threadId={selectedThread}
          currentUserId={userId}
          onBack={() => {
            setSelectedThread(null);
            setThreadsLoaded(false);
            loadThreads();
          }}
        />
      </div>
    );
  }

  // New message form
  if (showNewMessage) {
    return (
      <div className="bg-white rounded-xl border border-silver p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowNewMessage(false)}
            className="text-sm text-lavender hover:text-lavender-dark"
          >
            ← Back
          </button>
          <h3 className="font-heading text-lg font-semibold text-charcoal">
            New Message
          </h3>
        </div>

        <form onSubmit={handleNewMessage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              To
            </label>
            <SimpleSelect
              value={newRecipientId}
              onValueChange={setNewRecipientId}
              options={teacherOptions.map((t) => ({
                value: t.id,
                label: `${t.name} — ${t.class_name}`,
              }))}
              placeholder="Select a teacher..."
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Subject (optional)
            </label>
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g., Question about recital costume"
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Message
            </label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              placeholder="Type your message..."
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-y"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!newRecipientId || !newBody.trim() || sending}
            className="inline-flex h-10 items-center rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-silver mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("announcements")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "announcements"
                ? "border-lavender text-lavender-dark"
                : "border-transparent text-mist hover:text-charcoal"
            }`}
          >
            Announcements
            {announcements.filter((a) => !a.is_read).length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lavender px-1.5 text-xs font-bold text-white">
                {announcements.filter((a) => !a.is_read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("conversations")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "conversations"
                ? "border-lavender text-lavender-dark"
                : "border-transparent text-mist hover:text-charcoal"
            }`}
          >
            Conversations
          </button>
        </div>
        {tab === "conversations" && (
          <button
            onClick={() => setShowNewMessage(true)}
            className="inline-flex h-8 items-center rounded-lg bg-lavender px-4 text-xs font-semibold text-white hover:bg-lavender-dark transition-colors mb-1"
          >
            New Message
          </button>
        )}
      </div>

      {/* Announcements */}
      {tab === "announcements" && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center py-12 text-sm text-mist">
              No announcements yet. Check back soon!
            </div>
          ) : (
            announcements.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setExpandedAnnouncement(
                    expandedAnnouncement === a.id ? null : a.id
                  );
                  if (!a.is_read) markAnnouncementRead(a.id);
                }}
                className="w-full text-left rounded-xl border border-silver bg-white p-4 hover:border-lavender/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    {!a.is_read && (
                      <span className="h-2 w-2 rounded-full bg-lavender shrink-0" />
                    )}
                    <h3
                      className={`text-sm truncate ${
                        a.is_read
                          ? "text-charcoal"
                          : "font-semibold text-charcoal"
                      }`}
                    >
                      {a.title}
                    </h3>
                  </div>
                  <span className="text-xs text-mist shrink-0">
                    {formatDate(a.sent_at)}
                  </span>
                </div>
                {expandedAnnouncement === a.id && (
                  <div
                    className="mt-3 pt-3 border-t border-silver text-sm text-charcoal leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: a.body_html }}
                  />
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Conversations */}
      {tab === "conversations" && (
        <div className="space-y-2">
          {!threadsLoaded ? (
            <div className="text-center py-12 text-sm text-mist">
              Loading conversations...
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-mist mb-4">
                No conversations yet. Send a message to one of your
                dancer&apos;s teachers!
              </p>
              {teacherOptions.length > 0 && (
                <button
                  onClick={() => setShowNewMessage(true)}
                  className="inline-flex h-10 items-center rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
                >
                  Start a Conversation
                </button>
              )}
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedThread(t.id)}
                className="w-full text-left rounded-xl border border-silver bg-white p-4 hover:border-lavender/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-charcoal truncate">
                        {t.participant_names.join(", ")}
                      </h3>
                      {t.unread_count > 0 && (
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lavender px-1.5 text-xs font-bold text-white">
                          {t.unread_count}
                        </span>
                      )}
                    </div>
                    {t.subject && (
                      <p className="text-xs text-slate mt-0.5">{t.subject}</p>
                    )}
                    {t.last_message_preview && (
                      <p className="text-xs text-mist mt-1 truncate">
                        {t.last_message_preview}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-mist shrink-0">
                    {formatDate(t.last_message_at)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
