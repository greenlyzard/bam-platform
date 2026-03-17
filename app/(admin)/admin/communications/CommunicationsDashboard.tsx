"use client";

import { useState } from "react";
import { MessageThread } from "@/components/communications/MessageThread";
import { ChannelView } from "@/components/communications/ChannelView";

interface Announcement {
  id: string;
  title: string;
  audience: string;
  channel: string;
  status: string;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
  author_name: string;
}

interface ThreadPreview {
  id: string;
  subject: string | null;
  participant_names: string[];
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all_parents: "All Parents",
  class: "Specific Classes",
  season: "Season",
  teachers: "Teachers",
  all: "Everyone",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-mist/20 text-mist",
  sending: "bg-warning/10 text-warning",
  sent: "bg-success/10 text-success",
  failed: "bg-error/10 text-error",
};

export function CommunicationsDashboard({
  announcements,
  userId,
  isAdmin,
}: {
  announcements: Announcement[];
  userId: string;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<"channels" | "announcements" | "messages">("channels");
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

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

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (selectedThread) {
    return (
      <div className="bg-white rounded-xl border border-silver p-6 min-h-[500px] flex flex-col">
        <MessageThread
          threadId={selectedThread}
          currentUserId={userId}
          onBack={() => setSelectedThread(null)}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-silver mb-6">
        <button
          onClick={() => setTab("channels")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "channels"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-charcoal"
          }`}
        >
          Channels
        </button>
        <button
          onClick={() => setTab("announcements")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "announcements"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-charcoal"
          }`}
        >
          Announcements
        </button>
        <button
          onClick={() => {
            setTab("messages");
            loadThreads();
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "messages"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-charcoal"
          }`}
        >
          Messages
        </button>
      </div>

      {/* Channels tab */}
      {tab === "channels" && (
        <ChannelView userId={userId} isAdmin={isAdmin} />
      )}

      {/* Announcements tab */}
      {tab === "announcements" && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center py-12 text-sm text-mist">
              No announcements yet. Create your first one!
            </div>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-silver bg-white p-4 hover:border-lavender/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base font-semibold text-charcoal truncate">
                      {a.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="inline-flex items-center rounded-full bg-lavender/10 px-2.5 py-0.5 text-xs font-medium text-lavender-dark">
                        {AUDIENCE_LABELS[a.audience] ?? a.audience}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[a.status] ?? ""
                        }`}
                      >
                        {a.status}
                      </span>
                      <span className="text-xs text-mist">
                        {a.channel === "both"
                          ? "Email + In-App"
                          : a.channel === "in_app"
                            ? "In-App"
                            : "Email"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-mist">
                      {formatDate(a.sent_at ?? a.created_at)}
                    </p>
                    {a.status === "sent" && (
                      <p className="text-xs text-slate mt-0.5">
                        {a.recipient_count} recipients
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-mist mt-2">by {a.author_name}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages tab */}
      {tab === "messages" && (
        <div className="space-y-2">
          {!threadsLoaded ? (
            <div className="text-center py-12 text-sm text-mist">
              Loading messages...
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-sm text-mist">
              No message threads yet.
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
