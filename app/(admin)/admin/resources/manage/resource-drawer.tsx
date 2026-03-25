"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createResource, updateResource } from "./actions";
import { SimpleSelect } from "@/components/ui/select";

interface Location {
  id: string;
  name: string;
  is_active: boolean;
}

interface ResourceData {
  id: string;
  name: string;
  type: string;
  location_id: string | null;
  is_portable: boolean;
  color: string;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
}

const COLOR_OPTIONS = [
  { value: "lavender", label: "Lavender", class: "bg-lavender" },
  { value: "gold", label: "Gold", class: "bg-gold" },
  { value: "info", label: "Blue", class: "bg-info" },
  { value: "success", label: "Green", class: "bg-success" },
  { value: "error", label: "Red", class: "bg-error" },
  { value: "slate", label: "Gray", class: "bg-slate" },
];

const TYPE_OPTIONS = [
  { value: "room", label: "Room" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

export function ResourceDrawer({
  resource,
  locations,
  tenantId,
  onClose,
  onSaved,
}: {
  resource?: ResourceData;
  locations: Location[];
  tenantId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isEdit = !!resource;
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(resource?.name ?? "");
  const [type, setType] = useState(resource?.type ?? "room");
  const [locationId, setLocationId] = useState(resource?.location_id ?? "");
  const [isPortable, setIsPortable] = useState(resource?.is_portable ?? false);
  const [color, setColor] = useState(resource?.color ?? "lavender");
  const [capacity, setCapacity] = useState(resource?.capacity?.toString() ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [isActive, setIsActive] = useState(resource?.is_active ?? true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = useCallback(async (formData: FormData) => {
    setLoading(true);
    setError("");
    formData.set("tenant_id", tenantId);
    formData.set("name", name);
    formData.set("type", type);
    formData.set("location_id", isPortable ? "" : locationId);
    formData.set("is_portable", String(isPortable));
    formData.set("color", color);
    formData.set("capacity", type === "room" ? capacity : "");
    formData.set("description", description);
    formData.set("is_active", String(isActive));
    if (isEdit) formData.set("resourceId", resource!.id);

    const result = isEdit ? await updateResource(formData) : await createResource(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onSaved?.();
      onClose();
    }
  }, [isEdit, resource, tenantId, name, type, locationId, isPortable, color, capacity, description, isActive, onClose, onSaved]);

  const title = isEdit ? "Edit Resource" : "New Resource";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-silver px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-heading font-semibold text-charcoal">{title}</h2>
          <button onClick={onClose} className="text-slate hover:text-charcoal text-lg">✕</button>
        </div>
        <form ref={formRef} action={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Studio 1" className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Type *</label>
            <SimpleSelect
              value={type}
              onValueChange={setType}
              options={TYPE_OPTIONS}
              placeholder="Select type..."
              className="w-full"
            />
          </div>

          {/* Is Portable */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input type="checkbox" checked={isPortable} onChange={(e) => setIsPortable(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </span>
              <span className="text-sm font-medium text-charcoal">Portable</span>
            </label>
            <p className="mt-1 text-xs text-mist ml-11">Portable items move between locations</p>
          </div>

          {/* Location (hidden when portable) */}
          {!isPortable && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">Location</label>
              <SimpleSelect
                value={locationId}
                onValueChange={setLocationId}
                options={locations.filter((l) => l.is_active).map((l) => ({ value: l.id, label: l.name }))}
                placeholder="Select location..."
                className="w-full"
              />
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Color</label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)} className={`w-7 h-7 rounded-full ${c.class} transition-all ${color === c.value ? "ring-2 ring-offset-2 ring-lavender scale-110" : "opacity-60 hover:opacity-100"}`} title={c.label} />
              ))}
            </div>
          </div>

          {/* Capacity (rooms only) */}
          {type === "room" && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">Capacity</label>
              <input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Max students" className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional notes about this resource..." className="w-full rounded-md border border-silver bg-white px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none" />
          </div>

          {/* Is Active */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </span>
              <span className="text-sm font-medium text-charcoal">Active</span>
            </label>
          </div>

          {error && <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50">{loading ? "Saving..." : "Save Resource"}</button>
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
