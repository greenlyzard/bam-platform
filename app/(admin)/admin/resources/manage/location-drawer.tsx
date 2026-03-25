"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLocation, updateLocation } from "./actions";

interface LocationData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_primary: boolean;
  is_active: boolean;
}

export function LocationDrawer({
  location,
  tenantId,
  onClose,
  onSaved,
}: {
  location?: LocationData;
  tenantId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isEdit = !!location;
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [city, setCity] = useState(location?.city ?? "");
  const [state, setState] = useState(location?.state ?? "");
  const [zip, setZip] = useState(location?.zip ?? "");
  const [isPrimary, setIsPrimary] = useState(location?.is_primary ?? false);
  const [isActive, setIsActive] = useState(location?.is_active ?? true);
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
    formData.set("address", address);
    formData.set("city", city);
    formData.set("state", state);
    formData.set("zip", zip);
    formData.set("is_primary", String(isPrimary));
    formData.set("is_active", String(isActive));
    if (isEdit) formData.set("locationId", location!.id);

    const result = isEdit ? await updateLocation(formData) : await createLocation(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onSaved?.();
      onClose();
    }
  }, [isEdit, location, tenantId, name, address, city, state, zip, isPrimary, isActive, onClose, onSaved]);

  const title = isEdit ? "Edit Location" : "New Location";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-silver px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-heading font-semibold text-charcoal">{title}</h2>
          <button onClick={onClose} className="text-slate hover:text-charcoal text-lg">✕</button>
        </div>
        <form ref={formRef} action={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Studio" className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">ZIP</label>
              <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </span>
              <span className="text-sm font-medium text-charcoal">Primary location</span>
            </label>
          </div>
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
            <button type="submit" disabled={loading} className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50">{loading ? "Saving..." : "Save Location"}</button>
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
