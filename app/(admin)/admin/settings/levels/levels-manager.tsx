"use client";

import { useState } from "react";
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

export function LevelsManager({ initialLevels }: { initialLevels: string[] }) {
  const [levels, setLevels] = useState(initialLevels);
  const [newLevel, setNewLevel] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = levels.indexOf(active.id as string);
    const newIndex = levels.indexOf(over.id as string);
    setLevels(arrayMove(levels, oldIndex, newIndex));
  }

  function addLevel() {
    const trimmed = newLevel.trim();
    if (!trimmed || levels.includes(trimmed)) return;
    setLevels([...levels, trimmed]);
    setNewLevel("");
  }

  function removeLevel(level: string) {
    setLevels(levels.filter((l) => l !== level));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/studio-settings/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels }),
      });
      if (res.ok) {
        setToast("Saved");
        setTimeout(() => setToast(""), 2000);
      } else {
        setToast("Error saving");
      }
    } catch {
      setToast("Error saving");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{toast}</div>
      )}

      <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={levels} strategy={verticalListSortingStrategy}>
            {levels.map((level) => (
              <SortableLevel key={level} level={level} onRemove={() => removeLevel(level)} />
            ))}
          </SortableContext>
        </DndContext>
        {levels.length === 0 && (
          <div className="p-6 text-center text-sm text-mist">No levels configured.</div>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
          placeholder="New level name..."
          onKeyDown={(e) => { if (e.key === "Enter") addLevel(); }}
          className="flex-1 h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
        />
        <button
          onClick={addLevel}
          disabled={!newLevel.trim()}
          className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-4 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-6 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Order"}
      </button>
    </div>
  );
}

function SortableLevel({ level, onRemove }: { level: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: level });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 bg-white">
      <button {...attributes} {...listeners} className="cursor-grab text-mist hover:text-charcoal">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>
      <span className="flex-1 text-sm font-medium text-charcoal">{level}</span>
      <button
        onClick={onRemove}
        className="text-mist hover:text-red-500 transition-colors text-sm"
      >
        &times;
      </button>
    </div>
  );
}
