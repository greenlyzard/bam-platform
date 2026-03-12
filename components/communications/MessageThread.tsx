"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  is_own: boolean;
  created_at: string;
}

interface ThreadData {
  thread: {
    id: string;
    subject: string | null;
    participants: Record<string, { name: string; role: string }>;
  };
  messages: Message[];
}

export function MessageThread({
  threadId,
  currentUserId,
  onBack,
}: {
  threadId: string;
  currentUserId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/communications/messages/${threadId}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail on poll
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
    // Poll every 10 seconds
    pollRef.current = setInterval(fetchMessages, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/communications/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: newMessage.trim() }),
      });

      if (res.ok) {
        setNewMessage("");
        await fetchMessages();
      }
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-mist">
        Loading conversation...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-error">
        Failed to load conversation.
      </div>
    );
  }

  const otherParticipants = Object.entries(data.thread.participants)
    .filter(([id]) => id !== currentUserId)
    .map(([, p]) => p.name);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-silver pb-3 mb-4">
        <button
          onClick={onBack}
          className="text-sm text-lavender hover:text-lavender-dark transition-colors"
        >
          ← Back
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-semibold text-charcoal truncate">
            {data.thread.subject ?? otherParticipants.join(", ")}
          </h3>
          {data.thread.subject && (
            <p className="text-xs text-mist">
              with {otherParticipants.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-4">
        {data.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.is_own ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.is_own
                  ? "bg-lavender text-white rounded-br-md"
                  : "bg-cloud text-charcoal rounded-bl-md"
              }`}
            >
              {!msg.is_own && (
                <p
                  className={`text-xs font-semibold mb-0.5 ${
                    msg.is_own ? "text-white/80" : "text-lavender-dark"
                  }`}
                >
                  {msg.sender_name}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.is_own ? "text-white/60" : "text-mist"
                }`}
              >
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 border-t border-silver pt-3"
      >
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-none"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="inline-flex h-9 items-center rounded-lg bg-lavender px-4 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
