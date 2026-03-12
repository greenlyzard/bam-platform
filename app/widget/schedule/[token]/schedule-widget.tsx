"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  ScheduleEmbed,
  ScheduleInstanceWithDetails,
  Season,
} from "@/lib/calendar/types";
import styles from "./widget.module.css";

// ── Helpers ─────────────────────────────────────────────────

function getMonday(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${dh}:${m} ${ampm}`;
}

function formatDayHeader(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatWeekRange(monday: Date): string {
  const sat = new Date(monday);
  sat.setDate(monday.getDate() + 5);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${sat.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function levelBorderClass(level: string | null): string {
  const l = level?.toLowerCase().replace(/\s+/g, "_") ?? "";
  const map: Record<string, string> = {
    petite: styles.borderPetite,
    pre_ballet: styles.borderPreBallet,
    beginner: styles.borderBeginner,
    intermediate: styles.borderIntermediate,
    advanced: styles.borderAdvanced,
    pre_professional: styles.borderPreProfessional,
    open: styles.borderOpen,
  };
  return map[l] ?? styles.borderIntermediate;
}

function levelBadgeClass(level: string | null): string {
  const l = level?.toLowerCase().replace(/\s+/g, "_") ?? "";
  const map: Record<string, string> = {
    petite: styles.badgePetite,
    pre_ballet: styles.badgePreBallet,
    beginner: styles.badgeBeginner,
    intermediate: styles.badgeIntermediate,
    advanced: styles.badgeAdvanced,
    pre_professional: styles.badgePreProfessional,
    open: styles.badgeOpen,
  };
  return map[l] ?? styles.badgeIntermediate;
}

function printRowClass(level: string | null, isRehearsal: boolean): string {
  if (isRehearsal) return styles.printRowRehearsal;
  const l = level?.toLowerCase().replace(/\s+/g, "_") ?? "";
  const map: Record<string, string> = {
    petite: styles.printRowPetite,
    beginner: styles.printRowBeginner,
    intermediate: styles.printRowIntermediate,
    advanced: styles.printRowAdvanced,
    pre_professional: styles.printRowPreProfessional,
    open: styles.printRowOpen,
  };
  return map[l] ?? "";
}

function typeIcon(discipline: string | null, style: string | null): string {
  const d = (discipline ?? style ?? "").toLowerCase();
  if (d.includes("hip hop")) return "\uD83C\uDFA4";
  if (d.includes("contemporary") || d.includes("conditioning")) return "\uD83C\uDF0A";
  if (d.includes("jazz") || d.includes("musical")) return "\uD83C\uDFAD";
  return "\uD83E\uDE70";
}

function levelLabel(level: string | null): string {
  if (!level) return "";
  return level
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ───────────────────────────────────────────────

interface Props {
  token: string;
  embedConfig: ScheduleEmbed;
  initialWeek?: string;
  initialMode?: "week" | "list" | "print";
}

export function ScheduleWidget({
  token,
  embedConfig,
  initialWeek,
  initialMode = "week",
}: Props) {
  const [instances, setInstances] = useState<ScheduleInstanceWithDetails[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [monday, setMonday] = useState(() => getMonday(initialWeek));
  const [mode, setMode] = useState(initialMode);

  // Filters
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]));
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [showTrialsOnly, setShowTrialsOnly] = useState(false);
  const [showRehearsals, setShowRehearsals] = useState(embedConfig.show_rehearsals);

  const fetchData = useCallback(async (weekMonday: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/widget/schedule/${token}?week=${toISO(weekMonday)}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setInstances(json.data.instances ?? []);
      setSeasons(json.data.seasons ?? []);
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData(monday);
  }, [monday, fetchData]);

  // Update URL params without reload
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("week", toISO(monday));
    if (mode !== embedConfig.display_mode) params.set("mode", mode);
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }, [monday, mode, embedConfig.display_mode]);

  // Derive available levels and types from data
  const availableLevels = [...new Set(instances.map((i) => i.level).filter(Boolean) as string[])];
  const availableTypes = [...new Set(instances.map((i) => i.discipline ?? i.style).filter(Boolean) as string[])];

  // Apply local filters
  const filtered = instances.filter((inst) => {
    const eventDate = new Date(inst.event_date + "T00:00:00");
    const dayIdx = (eventDate.getDay() + 6) % 7; // 0=Mon, 5=Sat
    if (!selectedDays.has(dayIdx)) return false;
    if (selectedLevels.size > 0 && inst.level && !selectedLevels.has(inst.level)) return false;
    if (selectedTypes.size > 0) {
      const t = inst.discipline ?? inst.style ?? "";
      if (!selectedTypes.has(t)) return false;
    }
    if (showTrialsOnly && !inst.is_trial_eligible) return false;
    if (!showRehearsals && inst.event_type === "rehearsal") return false;
    return true;
  });

  // Group by day
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toISO(d));
  }
  const byDay: Record<string, ScheduleInstanceWithDetails[]> = {};
  for (const day of days) {
    byDay[day] = filtered.filter((e) => e.event_date === day);
  }

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const goWeek = (offset: number) => {
    setMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset * 7);
      return next;
    });
  };

  const goThisWeek = () => setMonday(getMonday());

  // ── Print Mode ──────────────────────────────────────────

  if (mode === "print") {
    return (
      <div className={styles.container}>
        <button className={styles.printButton} onClick={() => window.print()}>
          Print Schedule
        </button>
        <div className={styles.printHeader}>
          <p className={styles.printStudioName}>Ballet Academy and Movement</p>
          <p className={styles.printSubheader}>
            {seasons[0]?.name ?? ""} &middot; {formatWeekRange(monday)}
          </p>
        </div>
        {days.map((day) => {
          const dayEvents = byDay[day];
          if (!dayEvents || dayEvents.length === 0) return null;
          return (
            <div key={day}>
              <h3 className={styles.dayHeading}>{formatDayHeader(day)}</h3>
              <table className={styles.printTable}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Age</th>
                    <th>Level</th>
                    <th>Teacher</th>
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {dayEvents.map((e) => (
                    <tr
                      key={e.id}
                      className={printRowClass(e.level, e.event_type === "rehearsal")}
                    >
                      <td style={{ whiteSpace: "nowrap" }}>
                        {formatTime(e.start_time)} – {formatTime(e.end_time)}
                      </td>
                      <td>
                        {typeIcon(e.discipline, e.style)} {e.className}
                      </td>
                      <td>
                        {e.ageMin && e.ageMax
                          ? `${e.ageMin}–${e.ageMax === 99 ? "Adult" : e.ageMax}`
                          : ""}
                      </td>
                      <td>{levelLabel(e.level)}</td>
                      <td>{e.substituteTeacherName ?? e.teacherName ?? ""}</td>
                      <td>{e.roomName ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <div className={styles.printFooter}>
          balletacademyandmovement.com &middot; (949) 229-0846 &middot;
          dance@bamsocal.com
        </div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            className={styles.navButton}
            onClick={() => setMode("week")}
          >
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  // ── Week / List Mode ────────────────────────────────────

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Class Schedule</h1>
        <p className={styles.subtitle}>{formatWeekRange(monday)}</p>
      </div>

      {/* Week Navigation */}
      <div className={styles.weekNav}>
        <button className={styles.navButton} onClick={() => goWeek(-1)}>
          &larr; Previous Week
        </button>
        <button
          className={`${styles.navButton} ${styles.navButtonActive}`}
          onClick={goThisWeek}
        >
          This Week
        </button>
        <button className={styles.navButton} onClick={() => goWeek(1)}>
          Next Week &rarr;
        </button>
        <button
          className={styles.navButton}
          onClick={() => setMode("print")}
          title="Print view"
        >
          Print
        </button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        {embedConfig.allow_filter_day && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Day</span>
            <div className={styles.filterPills}>
              {DAY_NAMES.map((name, idx) => (
                <button
                  key={idx}
                  className={`${styles.pill} ${selectedDays.has(idx) ? styles.pillActive : ""}`}
                  onClick={() => toggleDay(idx)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {embedConfig.allow_filter_level && availableLevels.length > 0 && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Level</span>
            <div className={styles.filterPills}>
              {availableLevels.map((lv) => (
                <button
                  key={lv}
                  className={`${styles.pill} ${selectedLevels.has(lv) ? styles.pillActive : ""}`}
                  onClick={() => toggleLevel(lv)}
                >
                  {levelLabel(lv)}
                </button>
              ))}
            </div>
          </div>
        )}

        {embedConfig.allow_filter_class_type && availableTypes.length > 0 && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Style</span>
            <div className={styles.filterPills}>
              {availableTypes.map((t) => (
                <button
                  key={t}
                  className={`${styles.pill} ${selectedTypes.has(t) ? styles.pillActive : ""}`}
                  onClick={() => toggleType(t)}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        )}

        {embedConfig.allow_filter_trial && (
          <div className={styles.filterGroup}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={showTrialsOnly}
                onChange={(e) => setShowTrialsOnly(e.target.checked)}
              />
              Trial Classes Only
            </label>
          </div>
        )}

        {embedConfig.allow_filter_rehearsal && (
          <div className={styles.filterGroup}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={showRehearsals}
                onChange={(e) => setShowRehearsals(e.target.checked)}
              />
              Include Rehearsals
            </label>
          </div>
        )}

        {embedConfig.allow_filter_season && seasons.length > 1 && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Season</span>
            <select className={styles.filterSelect}>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className={styles.emptyState}>
          <p>Loading schedule...</p>
        </div>
      )}

      {/* Schedule */}
      {!loading && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <p>No classes match your filters.</p>
          <p style={{ marginTop: 8 }}>
            Adjust the filters above or call us at (949) 229-0846.
          </p>
        </div>
      )}

      {!loading &&
        (mode === "list" ? (
          // List mode: flat chronological
          <div>
            {days.map((day) => {
              const dayEvents = byDay[day];
              if (!dayEvents || dayEvents.length === 0) return null;
              return (
                <div key={day} className={styles.daySection}>
                  <h2 className={styles.dayHeading}>{formatDayHeader(day)}</h2>
                  {dayEvents.map((e) => (
                    <ClassCard
                      key={e.id}
                      event={e}
                      showTeacher={embedConfig.show_teacher}
                      showRoom={embedConfig.show_room}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          // Week mode: grid by day
          days.map((day, idx) => {
            const dayEvents = byDay[day];
            if (!dayEvents || dayEvents.length === 0) return null;
            return (
              <div key={day} className={styles.daySection}>
                <h2 className={styles.dayHeading}>{DAY_FULL[idx]}</h2>
                <div className={styles.classGrid}>
                  {dayEvents.map((e) => (
                    <ClassCard
                      key={e.id}
                      event={e}
                      showTeacher={embedConfig.show_teacher}
                      showRoom={embedConfig.show_room}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ))}
    </div>
  );
}

// ── Class Card Component ──────────────────────────────────

function ClassCard({
  event: e,
  showTeacher,
  showRoom,
}: {
  event: ScheduleInstanceWithDetails;
  showTeacher: boolean;
  showRoom: boolean;
}) {
  const isRehearsal = e.event_type === "rehearsal";
  const borderClass = isRehearsal
    ? styles.borderRehearsal
    : levelBorderClass(e.level);

  return (
    <div className={`${styles.card} ${borderClass}`}>
      <div className={styles.cardMeta}>
        <span className={styles.typeIcon}>
          {typeIcon(e.discipline, e.style)}
        </span>
        {e.level && (
          <span className={`${styles.badge} ${levelBadgeClass(e.level)}`}>
            {levelLabel(e.level)}
          </span>
        )}
        {e.is_trial_eligible && (
          <span className={`${styles.badge} ${styles.badgeTrial}`}>
            Trial Available
          </span>
        )}
        {isRehearsal && (
          <span className={`${styles.badge} ${styles.badgeRehearsal}`}>
            Rehearsal
          </span>
        )}
      </div>
      <p className={styles.cardName}>{e.className ?? e.event_type}</p>
      <p className={styles.cardTime}>
        {formatTime(e.start_time)} – {formatTime(e.end_time)}
        {showRoom && e.roomName && ` · ${e.roomName}`}
      </p>
      {e.ageMin != null && e.ageMax != null && (
        <p className={styles.cardAge}>
          Ages {e.ageMin}–{e.ageMax === 99 ? "Adult" : e.ageMax}
        </p>
      )}
      {showTeacher && (e.teacherName || e.substituteTeacherName) && (
        <p className={styles.teacherName}>
          {e.substituteTeacherName
            ? `Sub: ${e.substituteTeacherName}`
            : e.teacherName}
        </p>
      )}
    </div>
  );
}
