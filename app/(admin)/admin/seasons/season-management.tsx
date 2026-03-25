"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { SeasonEditDrawer } from "./season-edit-drawer";
import {
  toggleSeasonActive,
  toggleRegistrationOpen,
  deleteSeason,
  duplicateSeasonClasses,
  updateSeasonPriority,
} from "./actions";

interface ProgramType {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_public: boolean;
}

interface Season {
  id: string;
  name: string;
  program_type_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  is_active: boolean;
  registration_open: boolean;
  display_priority: number;
  created_at: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  lavender: { bg: "bg-lavender/10", text: "text-lavender-dark" },
  info: { bg: "bg-info/10", text: "text-info" },
  error: { bg: "bg-error/10", text: "text-error" },
  gold: { bg: "bg-gold/10", text: "text-gold-dark" },
  success: { bg: "bg-success/10", text: "text-success" },
  slate: { bg: "bg-cloud", text: "text-slate" },
};

function getProgramBadge(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.slate;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SeasonManagement({
  seasons: initialSeasons,
  classCounts,
  programTypes,
  tenantId,
}: {
  seasons: Season[];
  classCounts: Record<string, number>;
  programTypes: ProgramType[];
  tenantId: string;
}) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | undefined>();
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [copyPrompt, setCopyPrompt] = useState<{ sourceId: string; targetId: string; sourceName: string } | null>(null);
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const dragItemRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);

  const programTypeMap = new Map(programTypes.map((pt) => [pt.id, pt]));

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openNew() {
    setEditingSeason(undefined);
    setIsDuplicate(false);
    setDrawerOpen(true);
  }

  function openEdit(season: Season) {
    setEditingSeason(season);
    setIsDuplicate(false);
    setDrawerOpen(true);
  }

  function openDuplicate(season: Season) {
    setEditingSeason(season);
    setIsDuplicate(true);
    setDrawerOpen(true);
  }

  function handleDrawerSaved(newId: string) {
    if (isDuplicate && editingSeason) {
      setCopyPrompt({
        sourceId: editingSeason.id,
        targetId: newId,
        sourceName: editingSeason.name,
      });
    }
    showToast(isDuplicate ? "Season duplicated" : editingSeason ? "Season updated" : "Season created");
  }

  function handleToggleActive(seasonId: string, value: boolean) {
    // Optimistic update
    setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, is_active: value } : s));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seasonId", seasonId);
      fd.set("isActive", String(value));
      const result = await toggleSeasonActive(fd);
      if (result?.error) {
        // Revert
        setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, is_active: !value } : s));
        showToast(result.error);
      }
    });
  }

  function handleToggleRegistration(seasonId: string, value: boolean) {
    setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, registration_open: value } : s));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seasonId", seasonId);
      fd.set("registrationOpen", String(value));
      const result = await toggleRegistrationOpen(fd);
      if (result?.error) {
        setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, registration_open: !value } : s));
        showToast(result.error);
      }
    });
  }

  function handleDelete(seasonId: string) {
    setDeleteError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seasonId", seasonId);
      const result = await deleteSeason(fd);
      if (result?.error) {
        setDeleteError(result.error);
      } else {
        setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
        setConfirmDeleteId(null);
        showToast("Season deleted");
      }
    });
  }

  function handleCopyClasses() {
    if (!copyPrompt) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sourceSeasonId", copyPrompt.sourceId);
      fd.set("targetSeasonId", copyPrompt.targetId);
      const result = await duplicateSeasonClasses(fd);
      if (result && "count" in result) {
        showToast(`${result.count} class${result.count === 1 ? "" : "es"} copied`);
      } else if (result?.error) {
        showToast(result.error);
      }
      setCopyPrompt(null);
    });
  }

  // Drag and drop reorder
  function handleDragStart(seasonId: string) {
    dragItemRef.current = seasonId;
  }

  function handleDragOver(e: React.DragEvent, seasonId: string) {
    e.preventDefault();
    dragOverRef.current = seasonId;
  }

  function handleDrop() {
    const dragId = dragItemRef.current;
    const dropId = dragOverRef.current;
    if (!dragId || !dropId || dragId === dropId) return;

    const newSeasons = [...seasons];
    const dragIdx = newSeasons.findIndex((s) => s.id === dragId);
    const dropIdx = newSeasons.findIndex((s) => s.id === dropId);
    if (dragIdx === -1 || dropIdx === -1) return;

    const [moved] = newSeasons.splice(dragIdx, 1);
    newSeasons.splice(dropIdx, 0, moved);

    // Update priorities
    const updated = newSeasons.map((s, i) => ({ ...s, display_priority: i }));
    setSeasons(updated);

    // Persist all changed priorities
    startTransition(async () => {
      for (const s of updated) {
        const fd = new FormData();
        fd.set("seasonId", s.id);
        fd.set("priority", String(s.display_priority));
        await updateSeasonPriority(fd);
      }
    });

    dragItemRef.current = null;
    dragOverRef.current = null;
  }

  const sorted = [...seasons].sort((a, b) => a.display_priority - b.display_priority);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">Seasons</h1>
          <p className="mt-1 text-sm text-slate">Manage seasons, enrollment periods, and program schedules.</p>
        </div>
        <button
          onClick={openNew}
          className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5 transition-colors"
        >
          + New Season
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] bg-charcoal text-white text-sm px-4 py-2.5 rounded-lg shadow-lg animate-in fade-in-0">
          {toast}
        </div>
      )}

      {/* Copy classes prompt */}
      {copyPrompt && (
        <div className="rounded-xl border border-lavender/30 bg-lavender/5 p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-charcoal">
            Season created. Copy classes from <span className="font-semibold">{copyPrompt.sourceName}</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCopyClasses}
              disabled={isPending}
              className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-4 transition-colors disabled:opacity-50"
            >
              {isPending ? "Copying..." : "Yes, copy classes"}
            </button>
            <button
              onClick={() => setCopyPrompt(null)}
              className="h-9 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-4 transition-colors"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {/* Season list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-mist mb-2">No seasons yet</p>
          <p className="text-sm text-slate">Create your first season to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((season) => {
            const pt = season.program_type_id ? programTypeMap.get(season.program_type_id) : null;
            const badge = getProgramBadge(pt?.color ?? "slate");
            const classCount = classCounts[season.id] ?? 0;
            const isDeleting = confirmDeleteId === season.id;

            return (
              <div
                key={season.id}
                draggable
                onDragStart={() => handleDragStart(season.id)}
                onDragOver={(e) => handleDragOver(e, season.id)}
                onDrop={handleDrop}
                className="rounded-xl border border-silver bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  <span className="text-mist hover:text-slate cursor-grab active:cursor-grabbing mt-0.5 select-none text-lg leading-none">
                    ⠿
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Top row: name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-charcoal">{season.name}</span>
                      {pt && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                          {pt.name}
                        </span>
                      )}
                      {season.is_ongoing ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">Ongoing</span>
                      ) : null}
                      {pt && !pt.is_public && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error font-medium">⚠ Never public</span>
                      )}
                    </div>

                    {/* Date range + class count */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate">
                      {season.is_ongoing ? (
                        <span>{formatDate(season.start_date)} → Ongoing</span>
                      ) : (
                        <span>
                          {formatDate(season.start_date)}
                          {season.end_date ? ` → ${formatDate(season.end_date)}` : ""}
                        </span>
                      )}
                      <span className="text-mist">·</span>
                      <span>{classCount} class{classCount !== 1 ? "es" : ""}</span>
                    </div>

                    {/* Toggles + actions */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      {/* Active toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={season.is_active}
                            onChange={(e) => handleToggleActive(season.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </span>
                        <span className="text-xs text-slate">Active</span>
                      </label>

                      {/* Registration toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={season.registration_open}
                            onChange={(e) => handleToggleRegistration(season.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-success transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </span>
                        <span className="text-xs text-slate">Registration</span>
                      </label>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => openEdit(season)}
                          className="text-xs text-lavender hover:text-lavender-dark font-medium px-2 py-1 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDuplicate(season)}
                          className="text-xs text-lavender hover:text-lavender-dark font-medium px-2 py-1 rounded transition-colors"
                        >
                          Duplicate
                        </button>
                        <Link
                          href={`/admin/classes?season=${season.id}`}
                          className="text-xs text-lavender hover:text-lavender-dark font-medium px-2 py-1 rounded transition-colors"
                        >
                          View Classes →
                        </Link>

                        {!isDeleting ? (
                          <button
                            onClick={() => { setConfirmDeleteId(season.id); setDeleteError(""); }}
                            className="text-xs text-error hover:text-error/80 font-medium px-2 py-1 rounded transition-colors"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-slate">Delete?</span>
                            <button
                              onClick={() => handleDelete(season.id)}
                              disabled={isPending}
                              className="text-xs text-error font-semibold disabled:opacity-50"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-slate"
                            >
                              No
                            </button>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete error */}
                    {isDeleting && deleteError && (
                      <p className="mt-2 text-xs text-error">{deleteError}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manage program types link */}
      <div className="pt-2">
        <Link
          href="/admin/settings/program-types"
          className="text-xs text-lavender hover:text-lavender-dark font-medium transition-colors"
        >
          Manage program types →
        </Link>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <SeasonEditDrawer
          season={editingSeason}
          isDuplicate={isDuplicate}
          programTypes={programTypes}
          tenantId={tenantId}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleDrawerSaved}
        />
      )}
    </div>
  );
}
