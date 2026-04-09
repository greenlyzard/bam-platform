"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏"];

const POST_TYPES = [
  { value: "announcement", label: "Announcement" },
  { value: "event", label: "Event" },
  { value: "file", label: "File" },
];

interface Post {
  id: string;
  post_type: string;
  content: string | null;
  metadata: Record<string, unknown>;
  view_count: number;
  created_at: string | null;
  created_at_label: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string | null;
  reactions: Record<string, { count: number; mine: boolean }>;
}

interface Props {
  groupId: string;
  posts: Post[];
  chatMode: string;
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function GroupFeedClient({ groupId, posts, chatMode }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("announcement");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"feed" | "calendar">("feed");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedEvent, setSelectedEvent] = useState<Post | null>(null);

  async function submit() {
    if (!content.trim()) {
      setError("Write something first");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/communications/groups/${groupId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), post_type: postType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setContent("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleReaction(postId: string, emoji: string) {
    try {
      await fetch(`/api/admin/communications/groups/${groupId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, emoji }),
      });
      router.refresh();
    } catch {
      // ignore
    }
  }

  const eventPosts = posts.filter((p) => {
    if (p.post_type !== "event") return false;
    const m = p.metadata as { event_date?: string };
    return !!m.event_date;
  });

  return (
    <>
      {/* Tab bar */}
      <div className="mt-2 flex gap-1 border-b border-silver">
        <button
          type="button"
          onClick={() => setTab("feed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "feed"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-slate hover:text-charcoal"
          }`}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={() => setTab("calendar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "calendar"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-slate hover:text-charcoal"
          }`}
        >
          Calendar
        </button>
      </div>

      {tab === "calendar" && (
        <CalendarView
          year={calendarMonth.year}
          month={calendarMonth.month}
          events={eventPosts}
          onPrev={() =>
            setCalendarMonth((m) => {
              const d = new Date(m.year, m.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })
          }
          onNext={() =>
            setCalendarMonth((m) => {
              const d = new Date(m.year, m.month + 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })
          }
          onSelect={setSelectedEvent}
          selected={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Feed */}
      {tab === "feed" && (
      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white/50 p-8 text-center">
            <p className="text-sm text-slate">
              No posts yet. Create the first announcement.
            </p>
          </div>
        ) : (
          posts.map((p) => {
            const initials = initialsFor(p.author_name);
            const meta = p.metadata as {
              event_date?: string;
              start_time?: string;
              end_time?: string;
              location?: string;
              file_url?: string;
              file_name?: string;
            };
            return (
              <article
                key={p.id}
                className="rounded-xl border border-silver bg-white p-4 shadow-sm"
              >
                <header className="mb-3 flex items-center gap-3">
                  {p.author_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.author_avatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender/10 text-sm font-semibold text-lavender-dark">
                      {initials || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-charcoal">{p.author_name}</p>
                      {p.author_role && (
                        <span className="rounded-full bg-cloud px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate">
                          {p.author_role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-mist">{p.created_at_label}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-mist">
                    {p.post_type}
                  </span>
                </header>

                {p.content && (
                  <p className="whitespace-pre-wrap text-sm text-charcoal">{p.content}</p>
                )}

                {p.post_type === "event" && meta.event_date && (
                  <div className="mt-3 rounded-lg border border-lavender/30 bg-lavender/5 p-3">
                    <p className="text-sm font-semibold text-charcoal">
                      {meta.event_date}
                      {meta.start_time ? ` · ${meta.start_time}` : ""}
                      {meta.end_time ? `–${meta.end_time}` : ""}
                    </p>
                    {meta.location && (
                      <p className="mt-0.5 text-xs text-slate">{meta.location}</p>
                    )}
                  </div>
                )}

                {p.post_type === "file" && meta.file_url && (
                  <a
                    href={meta.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-silver bg-cloud/50 px-3 py-2 text-sm text-charcoal hover:bg-cloud"
                  >
                    📎 {meta.file_name ?? "Attachment"}
                  </a>
                )}

                <footer className="mt-3 flex items-center justify-between border-t border-silver pt-3">
                  <div className="flex items-center gap-1.5">
                    {REACTION_EMOJIS.map((e) => {
                      const r = p.reactions[e];
                      const active = r?.mine;
                      return (
                        <button
                          key={e}
                          type="button"
                          onClick={() => toggleReaction(p.id, e)}
                          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                            active
                              ? "border-lavender bg-lavender/10 text-lavender-dark"
                              : "border-silver text-slate hover:border-lavender/40"
                          }`}
                        >
                          <span>{e}</span>
                          {r?.count ? <span className="font-semibold">{r.count}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-mist">
                    <span>👁 {p.view_count}</span>
                    <span>💬 0</span>
                  </div>
                </footer>
              </article>
            );
          })
        )}
      </div>
      )}

      {/* Compose */}
      <div className="sticky bottom-0 mt-2 border-t border-silver bg-cream/95 pt-4 backdrop-blur">
        {chatMode === "disabled" ? (
          <p className="rounded-lg border border-dashed border-silver bg-white p-3 text-center text-xs text-slate">
            Chat is disabled for this group.
          </p>
        ) : (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Write an announcement..."
              className="w-full rounded-md border border-silver bg-white px-3 py-2 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
            />
            <div className="flex items-center justify-between gap-2">
              <Select value={postType} onValueChange={setPostType}>
                <SelectTrigger className="h-10 w-auto min-w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lavender-dark disabled:opacity-50"
              >
                {submitting ? "Posting…" : "Post"}
              </button>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        )}
      </div>
    </>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CalendarView({
  year,
  month,
  events,
  onPrev,
  onNext,
  onSelect,
  selected,
  onClose,
}: {
  year: number;
  month: number;
  events: Post[];
  onPrev: () => void;
  onNext: () => void;
  onSelect: (p: Post) => void;
  selected: Post | null;
  onClose: () => void;
}) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay: Record<number, Post[]> = {};
  for (const e of events) {
    const m = e.metadata as { event_date?: string };
    if (!m.event_date) continue;
    const d = new Date(`${m.event_date}T00:00:00`);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(e);
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const selectedMeta = (selected?.metadata ?? {}) as {
    event_date?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    teacher_name?: string;
  };

  return (
    <div className="flex flex-col gap-4 py-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-md border border-silver px-3 py-1.5 text-sm text-slate hover:bg-cloud"
          >
            ← Prev
          </button>
          <h2 className="font-heading text-lg text-charcoal">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md border border-silver px-3 py-1.5 text-sm text-slate hover:bg-cloud"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-silver bg-silver text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-cloud px-2 py-1.5 text-center font-semibold text-slate">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const dayEvents = day ? eventsByDay[day] ?? [] : [];
            return (
              <div
                key={i}
                className={`min-h-[88px] bg-white p-1.5 ${
                  day === todayDay ? "ring-2 ring-inset ring-lavender" : ""
                }`}
              >
                {day && (
                  <>
                    <div className="mb-1 text-right text-[11px] font-semibold text-slate">
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e) => {
                        const m = e.metadata as { start_time?: string };
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => onSelect(e)}
                            className="w-full truncate rounded bg-lavender/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-lavender-dark hover:bg-lavender/20"
                            title={e.content ?? ""}
                          >
                            {m.start_time ? `${m.start_time.slice(0, 5)} ` : ""}
                            {e.content ?? "Event"}
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-mist">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <aside className="w-full shrink-0 rounded-xl border border-silver bg-white p-4 lg:w-72">
          <div className="mb-3 flex items-start justify-between">
            <h3 className="font-heading text-base text-charcoal">Event</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-slate hover:text-charcoal"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-sm font-semibold text-charcoal">{selected.content}</p>
          {selectedMeta.event_date && (
            <p className="mt-2 text-xs text-slate">
              {selectedMeta.event_date}
              {selectedMeta.start_time ? ` · ${selectedMeta.start_time}` : ""}
              {selectedMeta.end_time ? `–${selectedMeta.end_time}` : ""}
            </p>
          )}
          {selectedMeta.location && (
            <p className="mt-1 text-xs text-slate">{selectedMeta.location}</p>
          )}
          {selectedMeta.teacher_name && (
            <p className="mt-1 text-xs text-slate">Teacher: {selectedMeta.teacher_name}</p>
          )}
          <p className="mt-3 text-[11px] text-mist">Posted by {selected.author_name}</p>
        </aside>
      )}
    </div>
  );
}
