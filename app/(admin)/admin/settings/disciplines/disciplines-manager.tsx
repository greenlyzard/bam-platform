"use client";

import { useCallback, useRef, useState } from "react";
import {
  saveDisciplineEdit, addDiscipline, toggleDisciplineActive,
  updateDisciplineSortOrder, deleteDiscipline,
} from "./actions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Discipline {
  id: string;
  name: string;
  description: string | null;
  icon_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface IconOption {
  id: string;
  name: string;
  icon_url: string | null;
}

export function DisciplinesManager({
  initialData,
  tenantId,
  iconLibrary,
}: {
  initialData: Discipline[];
  tenantId: string;
  iconLibrary: IconOption[];
}) {
  const [items, setItems] = useState<Discipline[]>(initialData);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIconId, setEditIconId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  function getIconUrl(iconId: string | null): string | null {
    if (!iconId) return null;
    return iconLibrary.find((i) => i.id === iconId)?.icon_url ?? null;
  }

  async function addItem() {
    if (!newName.trim()) return;
    setSaving(true);
    const maxOrder = items.reduce((max, i) => Math.max(max, i.sort_order), 0);
    const res = await addDiscipline(tenantId, newName.trim(), newDesc.trim() || null, maxOrder + 1);
    if (res.error) {
      alert(`Add failed: ${res.error}`);
    } else if (res.item) {
      setItems([...items, res.item]);
      setNewName("");
      setNewDesc("");
      flash("Added");
    }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await saveDisciplineEdit(id, editName.trim(), editDesc.trim() || null, editIconId);
    if (res.error) {
      alert(`Save failed: ${res.error}`);
      setSaving(false);
      return;
    }
    setItems(
      items.map((i) =>
        i.id === id
          ? { ...i, name: editName.trim(), description: editDesc.trim() || null, icon_id: editIconId }
          : i
      )
    );
    setEditingId(null);
    flash("Saved");
    setSaving(false);
  }

  async function toggleActive(id: string, currentState: boolean) {
    const res = await toggleDisciplineActive(id, !currentState);
    if (!res.error) {
      setItems(items.map((i) => (i.id === id ? { ...i, is_active: !currentState } : i)));
      flash(!currentState ? "Activated" : "Deactivated");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await deleteDiscipline(deleteTarget.id);
    if (res.error) {
      alert(`Delete failed: ${res.error}`);
    } else {
      setItems((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      flash("Deleted");
    }
    setDeleteTarget(null);
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

    const updated = reordered.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setItems(updated);
    dragItem.current = null;
    dragOverItem.current = null;

    await updateDisciplineSortOrder(updated.map((i) => ({ id: i.id, sort_order: i.sort_order })));
    flash("Reordered");
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>
      )}

      {/* List */}
      <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
        {items.length === 0 && (
          <div className="p-6 text-center text-sm text-mist">No disciplines yet. Add one below.</div>
        )}
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`group flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing ${
              !item.is_active ? "opacity-50" : ""
            }`}
          >
            {/* Icon */}
            {getIconUrl(item.icon_id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getIconUrl(item.icon_id)!} alt={item.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-lavender/20 flex items-center justify-center text-xs font-medium text-lavender shrink-0">
                {item.name.charAt(0)}
              </div>
            )}

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
                {/* Icon picker */}
                <div className="space-y-1">
                  <label className="text-xs text-mist">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditIconId(null)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs text-mist transition-all ${
                        editIconId === null ? "border-lavender bg-lavender/10" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      ✕
                    </button>
                    {iconLibrary.map((icon) => (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => setEditIconId(icon.id)}
                        className={`w-8 h-8 rounded-full border-2 overflow-hidden transition-all ${
                          editIconId === icon.id ? "border-lavender scale-110 shadow-md" : "border-transparent hover:border-gray-300"
                        }`}
                        title={icon.name}
                      >
                        {icon.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon.icon_url} alt={icon.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-lavender/20 flex items-center justify-center text-xs text-lavender">
                            {icon.name.charAt(0)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
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
                  setEditIconId(item.icon_id);
                }}
              >
                <p className="text-sm font-medium text-charcoal">{item.name}</p>
                {item.description && <p className="text-xs text-mist">{item.description}</p>}
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
                <button
                  onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-400 hover:text-red-600 px-2"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="rounded-xl border border-dashed border-silver bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-charcoal">Add Discipline</p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Discipline name"
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
        />
        <input
          type="text"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
        />
        <button
          onClick={addItem}
          disabled={saving || !newName.trim()}
          className="rounded-lg bg-lavender px-4 py-2 text-sm text-white hover:bg-lavender-dark disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discipline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?
              This will remove it from the disciplines list but won&apos;t affect existing class assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
