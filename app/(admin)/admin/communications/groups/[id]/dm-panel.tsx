"use client";

import { useEffect, useState } from "react";

interface DMMessage {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  body_text: string | null;
  created_at: string;
}

interface OtherProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

export function DmPanel({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/communications/dm/${profileId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setMessages(d.messages ?? []);
        setOther(d.other ?? null);
        setMeId(d.me_id ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/communications/dm/${profileId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_text: text.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.message) {
        setMessages((prev) => [...prev, json.message]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  const name =
    [other?.first_name, other?.last_name].filter(Boolean).join(" ") || "Direct Message";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-silver bg-white shadow-2xl">
      <header className="flex items-center gap-3 border-b border-silver p-4">
        {other?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender/10 text-sm font-semibold text-lavender-dark">
            {initials || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-charcoal">{name}</p>
          {other?.role && <p className="text-[11px] text-mist">{other.role}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-2xl leading-none text-slate hover:text-charcoal"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-xs text-mist">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-mist">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-lavender text-white"
                      : "bg-cloud text-charcoal"
                  }`}
                >
                  {m.body_text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-silver p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Write a message…"
            className="flex-1 resize-none rounded-md border border-silver bg-white px-3 py-2 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="h-12 rounded-lg bg-lavender px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
