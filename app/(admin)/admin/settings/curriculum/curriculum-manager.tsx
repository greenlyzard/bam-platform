"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface CurriculumItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export function CurriculumManager({
  initialData,
  tenantId,
}: {
  initialData: CurriculumItem[];
  tenantId: string;
}) {
  const [items, setItems] = useState<CurriculumItem[]>(initialData);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const supabase = createClient();

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  async function addItem() {
    if (!newName.trim()) return;
    setSaving(true);
    const maxOrder = items.reduce(
      (max, i) => Math.max(max, i.sort_order),
      0
    );
    const { data, error } = await supabase
      .from("dance_curriculum")
      .insert({
        tenant_id: tenantId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    if (!error && data) {
      setItems([...items, data]);
      setNewName("");
      setNewDesc("");
      flash("Added");
    }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("dance_curriculum")
      .update({
        name: editName.trim(),
        description: editDesc.trim() || null,
      })
      .eq("id", id);

    if (!error) {
      setItems(
        items.map((i) =>
          i.id === id
            ? { ...i, name: editName.trim(), description: editDesc.trim() || null }
            : i
        )
      );
      setEditingId(null);
      flash("Saved");
    }
    setSaving(false);
  }

  async function toggleActive(id: string, currentState: boolean) {
    const { error } = await supabase
      .from("dance_curriculum")
      .update({ is_active: !currentState })
      .eq("id", id);

    if (!error) {
      setItems(
        items.map((i) =>
          i.id === id ? { ...i, is_active: !currentState } : i
        )
      );
      flash(!currentState ? "Activated" : "Deactivated");
    }
  }

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...items];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);

    const updated = reordered.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setItems(updated);
    dragItem.current = null;
    dragOverItem.current = null;

    for (const item of updated) {
      await supabase
        .from("dance_curriculum")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);
    }
    flash("Reordered");
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
        {items.length === 0 && (
          <div className="p-6 text-center text-sm text-mist">
            No curriculum styles yet. Add one below.
          </div>
        )}
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing ${
              !item.is_active ? "opacity-50" : ""
            }`}
          >
            <span className="text-mist select-none">⠿</span>

            {editingId === item.id ? (
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-silver px-3 py-1.5 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-silver px-3 py-1.5 text-sm text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(item.id)}
                    disabled={saving}
                    className="rounded-lg bg-lavender px-3 py-1 text-xs text-white hover:bg-lavender-dark disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-cloud px-3 py-1 text-xs text-charcoal hover:bg-silver"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex-1 cursor-pointer"
                onClick={() => {
                  setEditingId(item.id);
                  setEditName(item.name);
                  setEditDesc(item.description ?? "");
                }}
              >
                <p className="text-sm font-medium text-charcoal">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-mist">{item.description}</p>
                )}
              </div>
            )}

            {editingId !== item.id && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(item.id, item.is_active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    item.is_active ? "bg-lavender" : "bg-silver"
                  }`}
                  title={item.is_active ? "Active" : "Inactive"}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      item.is_active ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="rounded-xl border border-dashed border-silver bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-charcoal">
          Add Curriculum Style
        </p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Curriculum name (e.g. RAD, Vaganova)"
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
        />
        <input
          type="text"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
        />
        <button
          onClick={addItem}
          disabled={saving || !newName.trim()}
          className="rounded-lg bg-lavender px-4 py-2 text-sm text-white hover:bg-lavender-dark disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
