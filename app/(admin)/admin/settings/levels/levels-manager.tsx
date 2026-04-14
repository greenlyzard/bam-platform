"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────
interface Level {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  age_min: number | null;
  age_max: number | null;
  sort_order: number;
  is_active: boolean;
  color_hex: string | null;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  requires_audition: boolean;
  has_contract: boolean;
  sort_order: number;
  is_active: boolean;
  eligible_level_ids: string[];
}

// ── Main ───────────────────────────────────────────────────────
export function LevelsAndProgramsManager({
  initialLevels,
  initialPrograms,
}: {
  initialLevels: Level[];
  initialPrograms: Program[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"levels" | "programs">("levels");
  const [levels, setLevels] = useState(initialLevels);
  const [programs, setPrograms] = useState(initialPrograms);
  const [toast, setToast] = useState("");

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {toast}
        </div>
      )}
      <div className="flex gap-1 border-b border-silver">
        {(["levels", "programs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-lavender text-lavender-dark"
                : "border-transparent text-slate hover:text-charcoal"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "levels" && (
        <LevelsTab
          levels={levels}
          setLevels={setLevels}
          flash={flash}
          refresh={() => router.refresh()}
        />
      )}
      {tab === "programs" && (
        <ProgramsTab
          programs={programs}
          setPrograms={setPrograms}
          levels={levels}
          flash={flash}
          refresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ── Levels Tab ─────────────────────────────────────────────────
function LevelsTab({
  levels,
  setLevels,
  flash,
  refresh,
}: {
  levels: Level[];
  setLevels: (l: Level[]) => void;
  flash: (m: string) => void;
  refresh: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [form, setForm] = useState<Partial<Level> & { open: boolean }>({ open: false });
  const [saving, setSaving] = useState(false);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (form.open) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }, [form.open, form.id]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(levels.filter((l) => !l.parent_id).map((l) => l.id)));

  const parents = levels.filter((l) => !l.parent_id);
  const childrenOf = (pid: string) =>
    levels.filter((l) => l.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDragEnd(event: { active: { id: string | number }; over: { id: string | number } | null }) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Only reorder within same level (top-level or siblings)
    const dragged = levels.find((l) => l.id === active.id);
    const target = levels.find((l) => l.id === over.id);
    if (!dragged || !target) return;
    if (dragged.parent_id !== target.parent_id) return;

    const siblings = dragged.parent_id
      ? levels.filter((l) => l.parent_id === dragged.parent_id)
      : parents;
    const oldIdx = siblings.findIndex((l) => l.id === active.id);
    const newIdx = siblings.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(siblings, oldIdx, newIdx);

    // Update full list
    const reorderedIds = new Set(reordered.map((l) => l.id));
    const newLevels = levels.map((l) => {
      if (!reorderedIds.has(l.id)) return l;
      const idx = reordered.findIndex((r) => r.id === l.id);
      return { ...l, sort_order: idx };
    });
    setLevels(newLevels);

    await fetch("/api/admin/studio-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", ids: reordered.map((l) => l.id) }),
    });
    flash("Order saved");
  }

  async function save() {
    setSaving(true);
    setLevelsError(null);
    const action = form.id ? "update" : "create";
    try {
      const res = await fetch("/api/admin/studio-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: form.id,
          name: form.name,
          description: form.description,
          parent_id: form.parent_id || null,
          age_min: form.age_min ?? null,
          age_max: form.age_max ?? null,
          color_hex: form.color_hex,
          sort_order: form.sort_order ?? levels.length,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLevelsError(json.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setForm({ open: false });
      setLevelsError(null);
      flash(action === "create" ? "Level added" : "Level updated");
      refresh();
    } catch (e) {
      setLevelsError(e instanceof Error ? e.message : "Network error");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this level? Sub-levels will become top-level.")) return;
    await fetch("/api/admin/studio-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    flash("Level deleted");
    refresh();
  }

  const allDragIds = levels.map((l) => l.id);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allDragIds} strategy={verticalListSortingStrategy}>
            {parents.map((p) => {
              const kids = childrenOf(p.id);
              const isExpanded = expanded.has(p.id);
              return (
                <div key={p.id}>
                  <LevelRow
                    level={p}
                    indent={false}
                    isEditing={form.open && form.id === p.id}
                    hasChildren={kids.length > 0}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(p.id)}
                    onEdit={() => setForm({ open: true, ...p })}
                    onRemove={() => remove(p.id)}
                    onAddChild={() =>
                      setForm({
                        open: true,
                        name: "",
                        parent_id: p.id,
                        sort_order: kids.length,
                      })
                    }
                  />
                  {isExpanded &&
                    kids.map((c) => (
                      <LevelRow
                        key={c.id}
                        level={c}
                        indent
                        isEditing={form.open && form.id === c.id}
                        hasChildren={false}
                        isExpanded={false}
                        onToggle={() => {}}
                        onEdit={() => setForm({ open: true, ...c })}
                        onRemove={() => remove(c.id)}
                        onAddChild={() => {}}
                      />
                    ))}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>
        {levels.length === 0 && (
          <div className="p-6 text-center text-sm text-mist">No levels configured.</div>
        )}
      </div>

      {!form.open && (
        <button
          type="button"
          onClick={() => setForm({ open: true, name: "", parent_id: null, sort_order: parents.length })}
          className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark"
        >
          + Add Level
        </button>
      )}

      {form.open && (
        <div ref={formRef} className="space-y-3 rounded-xl border border-lavender bg-white p-4 shadow-md">
          <h3 className="text-sm font-semibold text-charcoal">
            {form.id ? "Edit Level" : form.parent_id ? "New Sub-level" : "New Level"}
          </h3>
          {form.parent_id && (
            <p className="text-xs text-mist">
              Under: {levels.find((l) => l.id === form.parent_id)?.name ?? "Parent"}
            </p>
          )}
          <input
            type="text"
            placeholder="Level name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="number"
              placeholder="Age min"
              value={form.age_min ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, age_min: e.target.value ? parseInt(e.target.value, 10) : null }))}
              className="h-12 rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
            />
            <input
              type="number"
              placeholder="Age max"
              value={form.age_max ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, age_max: e.target.value ? parseInt(e.target.value, 10) : null }))}
              className="h-12 rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
            />
            <input
              type="color"
              value={form.color_hex || "#9C8BBF"}
              onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))}
              className="h-12 w-full rounded-md border border-silver bg-white"
            />
          </div>
          {levelsError && <p className="text-sm text-error">{levelsError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.name?.trim()}
              className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : form.id ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setForm({ open: false }); setLevelsError(null); }}
              className="h-10 rounded-lg border border-silver px-4 text-sm text-slate hover:bg-cloud"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelRow({
  level,
  indent,
  isEditing,
  hasChildren,
  isExpanded,
  onToggle,
  onEdit,
  onRemove,
  onAddChild,
}: {
  level: Level;
  indent: boolean;
  isEditing: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onAddChild: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: level.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 ${indent ? "pl-10" : ""} ${isEditing ? "bg-lavender/5 ring-1 ring-inset ring-lavender" : "bg-white"}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-mist hover:text-charcoal shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>
      {!indent && (
        <button
          type="button"
          onClick={onToggle}
          className="w-4 text-center text-xs text-mist hover:text-charcoal shrink-0"
        >
          {hasChildren ? (isExpanded ? "▼" : "▶") : "·"}
        </button>
      )}
      {indent && <span className="text-xs text-mist shrink-0">→</span>}
      {level.color_hex && (
        <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: level.color_hex }} />
      )}
      <span className="flex-1 text-sm font-medium text-charcoal">{level.name}</span>
      {(level.age_min != null || level.age_max != null) && (
        <span className="text-xs text-mist">
          {level.age_min ?? "?"}-{level.age_max ?? "?"} yrs
        </span>
      )}
      {!indent && (
        <button
          type="button"
          onClick={onAddChild}
          className="text-[11px] text-lavender hover:text-lavender-dark"
        >
          + Sub
        </button>
      )}
      <button onClick={onEdit} className="text-xs text-lavender hover:text-lavender-dark">Edit</button>
      <button onClick={onRemove} className="text-mist hover:text-error text-sm">&times;</button>
    </div>
  );
}

// ── Programs Tab ───────────────────────────────────────────────
function ProgramsTab({
  programs,
  setPrograms,
  levels,
  flash,
  refresh,
}: {
  programs: Program[];
  setPrograms: (p: Program[]) => void;
  levels: Level[];
  flash: (m: string) => void;
  refresh: () => void;
}) {
  const [form, setForm] = useState<Partial<Program> & { open: boolean; eligible_level_ids?: string[] }>({ open: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const action = form.id ? "update" : "create";
    try {
      const res = await fetch("/api/admin/studio-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: form.id,
          name: form.name,
          description: form.description,
          color_hex: form.color_hex,
          requires_audition: form.requires_audition ?? false,
          has_contract: form.has_contract ?? false,
          sort_order: form.sort_order ?? programs.length,
          eligible_level_ids: form.eligible_level_ids ?? [],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setForm({ open: false });
      setError(null);
      flash(action === "create" ? "Program added" : "Program updated");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this program?")) return;
    await fetch("/api/admin/studio-programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    flash("Program deleted");
    refresh();
  }

  function toggleLevel(levelId: string) {
    setForm((f) => {
      const ids = new Set(f.eligible_level_ids ?? []);
      if (ids.has(levelId)) ids.delete(levelId);
      else ids.add(levelId);
      return { ...f, eligible_level_ids: Array.from(ids) };
    });
  }

  return (
    <div className="space-y-4">
      {programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 p-6 text-center text-sm text-mist">
          No programs configured.
        </div>
      ) : (
        <div className="space-y-2">
          {programs.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-silver bg-white p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {p.color_hex && (
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color_hex }} />
                  )}
                  <p className="text-sm font-semibold text-charcoal">{p.name}</p>
                  {p.requires_audition && (
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold-dark">
                      Audition
                    </span>
                  )}
                  {p.has_contract && (
                    <span className="rounded-full bg-lavender/10 px-1.5 py-0.5 text-[10px] font-semibold text-lavender-dark">
                      Contract
                    </span>
                  )}
                </div>
                {p.description && <p className="mt-0.5 text-xs text-slate">{p.description}</p>}
                {p.eligible_level_ids.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.eligible_level_ids.map((lid) => {
                      const lev = levels.find((l) => l.id === lid);
                      return (
                        <span key={lid} className="rounded bg-cloud px-1.5 py-0.5 text-[10px] font-medium text-slate">
                          {lev?.name ?? lid.slice(0, 8)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      open: true,
                      ...p,
                    })
                  }
                  className="text-xs text-lavender hover:text-lavender-dark"
                >
                  Edit
                </button>
                <button onClick={() => remove(p.id)} className="text-sm text-mist hover:text-error">
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!form.open && (
        <button
          type="button"
          onClick={() => setForm({ open: true, name: "", eligible_level_ids: [] })}
          className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark"
        >
          + Add Program
        </button>
      )}

      {form.open && (
        <div className="space-y-3 rounded-xl border border-silver bg-white p-4">
          <h3 className="text-sm font-semibold text-charcoal">
            {form.id ? "Edit Program" : "New Program"}
          </h3>
          <input
            type="text"
            placeholder="Program name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border border-silver bg-white px-3 py-2 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={form.requires_audition ?? false}
                onChange={(e) => setForm((f) => ({ ...f, requires_audition: e.target.checked }))}
                className="rounded border-silver"
              />
              Requires Audition
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={form.has_contract ?? false}
                onChange={(e) => setForm((f) => ({ ...f, has_contract: e.target.checked }))}
                className="rounded border-silver"
              />
              Has Contract
            </label>
            <input
              type="color"
              value={form.color_hex || "#9C8BBF"}
              onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))}
              className="h-10 w-full rounded-md border border-silver bg-white"
            />
          </div>
          {levels.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-charcoal">Eligible Levels</p>
              <div className="flex flex-wrap gap-2">
                {levels.map((l) => {
                  const checked = (form.eligible_level_ids ?? []).includes(l.id);
                  return (
                    <label
                      key={l.id}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                        checked
                          ? "border-lavender bg-lavender/10 text-lavender-dark"
                          : "border-silver text-slate"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLevel(l.id)}
                        className="sr-only"
                      />
                      {l.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.name?.trim()}
              className="h-10 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : form.id ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setForm({ open: false }); setError(null); }}
              className="h-10 rounded-lg border border-silver px-4 text-sm text-slate hover:bg-cloud"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
