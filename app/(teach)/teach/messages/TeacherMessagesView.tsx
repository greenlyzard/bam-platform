"use client";

import { useState, useEffect } from "react";
import { MessageThread } from "@/components/communications/MessageThread";

interface Announcement {
  id: string;
  title: string;
  body_html: string;
  sent_at: string;
}

interface ThreadPreview {
  id: string;
  subject: string | null;
  participant_names: string[];
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
}

export function TeacherMessagesView({
  announcements,
  userId,
}: {
  announcements: Announcement[];
  userId: string;
}) {
  const [tab, setTab] = useState<"announcements" | "parents">("announcements");
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<
    string | null
  >(null);
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

  useEffect(() => {
    if (tab === "parents") loadThreads();
  }, [tab]);

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

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-silver mb-6">
        <button
          onClick={() => setTab("announcements")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "announcements"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-charcoal"
          }`}
        >
          Studio Announcements
        </button>
        <button
          onClick={() => setTab("parents")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "parents"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-mist hover:text-charcoal"
          }`}
        >
          Parent Messages
          {threads.reduce((sum, t) => sum + t.unread_count, 0) > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lavender px-1.5 text-xs font-bold text-white">
              {threads.reduce((sum, t) => sum + t.unread_count, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Studio Announcements */}
      {tab === "announcements" && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center py-12 text-sm text-mist">
              No studio announcements yet.
            </div>
          ) : (
            announcements.map((a) => (
              <button
                key={a.id}
                onClick={() =>
                  setExpandedAnnouncement(
                    expandedAnnouncement === a.id ? null : a.id
                  )
                }
                className="w-full text-left rounded-xl border border-silver bg-white p-4 hover:border-lavender/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-charcoal truncate">
                    {a.title}
                  </h3>
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

      {/* Parent Messages */}
      {tab === "parents" && (
        <div className="space-y-2">
          <p className="text-xs text-mist mb-4">
            Parents initiate conversations through their portal. You can reply
            to any thread here.
          </p>

          {!threadsLoaded ? (
            <div className="text-center py-12 text-sm text-mist">
              Loading messages...
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-sm text-mist">
              No parent messages yet. When a parent reaches out, their message
              will appear here.
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
