"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────
export interface EventItem {
  id: string;
  type: "class" | "private" | "rehearsal";
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  organizer: string | null;
  organizerId: string | null;
}

interface Props {
  events: EventItem[];
  canBookPrivate: boolean;
  portalMode: "parent" | "teacher";
}

// ── Helpers ───────────────────────────────────────────────────
const CATEGORY: Record<string, { label: string; bg: string; text: string }> = {
  class: { label: "BAM CLASSES", bg: "bg-[var(--color-lavender-light)]", text: "text-[var(--color-lavender-dark)]" },
  private: { label: "BAM PRIVATES", bg: "bg-[var(--color-info)]/15", text: "text-[var(--color-info)]" },
  rehearsal: { label: "BAM REHEARSALS", bg: "bg-[var(--color-gold-light)]", text: "text-[var(--color-gold-dark)]" },
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function dayNumber(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getDate();
}

function isSameDay(a: string, b: string) {
  return a === b;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Calendar helpers ──────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ── Component ─────────────────────────────────────────────────
export function EventsClient({ events, canBookPrivate, portalMode }: Props) {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calDate, setCalDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Group events by month for list view
  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      const key = monthKey(e.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  // Event dates set for calendar dots
  const eventDates = useMemo(() => new Set(events.map((e) => e.date)), [events]);

  const today = todayStr();

  // Calendar grid
  const calDays = useMemo(() => {
    const total = getDaysInMonth(calDate.year, calDate.month);
    const firstDay = getFirstDayOfMonth(calDate.year, calDate.month);
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calDate]);

  const calMonthLabel = new Date(calDate.year, calDate.month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function calDateStr(day: number) {
    return `${calDate.year}-${String(calDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function prevMonth() {
    setCalDate((c) => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
    });
    setSelectedDay(null);
  }

  function nextMonth() {
    setCalDate((c) => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
    });
    setSelectedDay(null);
  }

  const selectedEvents = selectedDay ? events.filter((e) => isSameDay(e.date, selectedDay)) : [];

  // FAB link
  const fabHref = portalMode === "parent" ? "/portal/book-private" : "/teach/privates";
  const fabLabel = portalMode === "parent" ? "Book Private" : "New Private";

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">Events</h1>
          <p className="mt-1 text-sm text-slate">
            {events.length} upcoming event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-silver overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-[var(--color-lavender)] text-white"
                : "bg-white text-slate hover:bg-[var(--color-cloud)]"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "calendar"
                ? "bg-[var(--color-lavender)] text-white"
                : "bg-white text-slate hover:bg-[var(--color-cloud)]"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* ── List View ────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="space-y-8">
          {events.length === 0 && (
            <div className="rounded-xl border border-silver bg-white p-8 text-center">
              <p className="text-sm text-slate">No upcoming events.</p>
            </div>
          )}
          {[...grouped.entries()].map(([month, items]) => (
            <section key={month}>
              <h2 className="text-lg font-heading font-semibold text-charcoal mb-4">{month}</h2>
              <div className="space-y-3">
                {items.map((evt) => (
                  <EventCard key={evt.id} event={evt} today={today} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Calendar View ────────────────────────────────────── */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-[var(--color-cloud)] transition-colors">
              &larr;
            </button>
            <span className="text-base font-heading font-semibold text-charcoal">{calMonthLabel}</span>
            <button onClick={nextMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-[var(--color-cloud)] transition-colors">
              &rarr;
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-mist mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px">
            {calDays.map((day, i) => {
              if (day == null) return <div key={`empty-${i}`} className="h-10" />;
              const ds = calDateStr(day);
              const isToday = ds === today;
              const hasEvents = eventDates.has(ds);
              const isSelected = ds === selectedDay;

              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDay(ds)}
                  className={`h-10 flex flex-col items-center justify-center rounded-lg text-sm transition-colors relative ${
                    isSelected
                      ? "bg-[var(--color-lavender)] text-white"
                      : isToday
                        ? "bg-[var(--color-lavender-light)] text-[var(--color-lavender-dark)] font-semibold"
                        : "text-charcoal hover:bg-[var(--color-cloud)]"
                  }`}
                >
                  {day}
                  {hasEvents && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--color-lavender)]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Events for selected day */}
          {selectedDay && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-medium text-slate">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {selectedEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-6 text-center">
                  <p className="text-sm text-mist">No events this day.</p>
                </div>
              ) : (
                selectedEvents.map((evt) => (
                  <EventCard key={evt.id} event={evt} today={today} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FAB ──────────────────────────────────────────────── */}
      {canBookPrivate && (
        <Link
          href={fabHref}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[var(--color-lavender)] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[var(--color-lavender-dark)] transition-colors sm:bottom-8 sm:right-8"
        >
          <span className="text-lg leading-none">+</span>
          {fabLabel}
        </Link>
      )}
    </>
  );
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ event, today }: { event: EventItem; today: string }) {
  const cat = CATEGORY[event.type] ?? CATEGORY.class;
  const isToday = event.date === today;

  return (
    <div className="flex gap-4 rounded-xl border border-silver bg-white p-4 hover:shadow-sm transition-shadow">
      {/* Date column */}
      <div className="flex flex-col items-center justify-center w-14 shrink-0">
        <span className={`text-2xl font-heading font-bold leading-none ${isToday ? "text-[var(--color-lavender)]" : "text-charcoal"}`}>
          {dayNumber(event.date)}
        </span>
        <span className="text-xs font-medium text-mist mt-0.5">{dayLabel(event.date)}</span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-charcoal truncate">{event.title}</h3>
          <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${cat.bg} ${cat.text}`}>
            {cat.label}
          </span>
        </div>
        <p className="text-sm text-slate">
          {formatTime(event.startTime)} &ndash; {formatTime(event.endTime)}
        </p>
        {event.location && (
          <p className="text-xs text-mist mt-0.5">{event.location}</p>
        )}
        {event.organizer && (
          <p className="text-xs text-mist mt-0.5">{event.organizer}</p>
        )}
      </div>
    </div>
  );
}
