"use client";

import { useState } from "react";
import {
  updateStudioIdentity,
  upsertLocation,
  upsertRoom,
  toggleLocationActive,
  toggleRoomActive,
} from "./actions";

interface StudioSettings {
  id: string;
  studio_name: string;
  logo_url: string | null;
  favicon_url: string | null;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
  is_bookable: boolean;
  is_active: boolean;
  color_hex: string | null;
  location_id: string | null;
  notes: string | null;
}

export function StudioSettingsClient({
  studioSettings,
  locations: initialLocations,
  rooms: initialRooms,
}: {
  studioSettings: StudioSettings | null;
  locations: Location[];
  rooms: Room[];
}) {
  return (
    <div className="space-y-8">
      <IdentitySection settings={studioSettings} />
      <LocationsSection
        initialLocations={initialLocations}
        initialRooms={initialRooms}
      />
      <ContactSection />
    </div>
  );
}

// ── SECTION 1: Studio Identity ──────────────────────────
function IdentitySection({ settings }: { settings: StudioSettings | null }) {
  const [studioName, setStudioName] = useState(settings?.studio_name ?? "");
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(settings?.favicon_url ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function handleSave() {
    setSaving(true);
    const result = await updateStudioIdentity({
      studio_name: studioName,
      logo_url: logoUrl || null,
      favicon_url: faviconUrl || null,
    });
    setSaving(false);
    if (result.success) {
      setToast("Saved");
      setTimeout(() => setToast(""), 2000);
    } else {
      setToast(result.error ?? "Error saving");
    }
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold text-charcoal mb-1">
        Studio Identity
      </h2>
      <p className="text-sm text-slate mb-4">
        Your studio name and branding assets.
      </p>
      <div className="rounded-xl border border-silver bg-white p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Studio Name
          </label>
          <input
            type="text"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            className="w-full max-w-md h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Logo URL
          </label>
          <div className="flex items-start gap-4">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="flex-1 max-w-md h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
            {logoUrl && (
              <div className="h-12 w-12 rounded-lg border border-silver bg-white flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Favicon URL
          </label>
          <div className="flex items-start gap-4">
            <input
              type="url"
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
              placeholder="https://example.com/favicon.png"
              className="flex-1 max-w-md h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
            {faviconUrl && (
              <div className="h-10 w-10 rounded-lg border border-silver bg-white flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faviconUrl} alt="Favicon" className="h-8 w-8 object-contain" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Identity"}
          </button>
          {toast && (
            <span className="text-sm text-green-600">{toast}</span>
          )}
        </div>
      </div>
    </section>
  );
}

// ── SECTION 2: Locations & Rooms ────────────────────────
function LocationsSection({
  initialLocations,
  initialRooms,
}: {
  initialLocations: Location[];
  initialRooms: Room[];
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [rooms, setRooms] = useState(initialRooms);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [addingRoomForLocation, setAddingRoomForLocation] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Locations
          </h2>
          <p className="text-sm text-slate mt-0.5">
            Manage your studio locations and rooms.
          </p>
        </div>
        <button
          onClick={() => setShowAddLocation(true)}
          className="text-sm font-medium text-lavender hover:text-lavender-dark"
        >
          + Add Location
        </button>
      </div>

      {showAddLocation && (
        <LocationForm
          onSave={async (loc) => {
            const result = await upsertLocation(loc);
            if (result.success) {
              setShowAddLocation(false);
              window.location.reload();
            }
          }}
          onCancel={() => setShowAddLocation(false)}
        />
      )}

      <div className="space-y-4">
        {locations.map((loc) => {
          const locRooms = rooms.filter((r) => r.location_id === loc.id);
          const isEditing = editingLocationId === loc.id;

          return (
            <div
              key={loc.id}
              className="rounded-xl border border-silver bg-white overflow-hidden"
            >
              {/* Location header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-charcoal">
                        {loc.name}
                      </h3>
                      {loc.is_primary && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-lavender/10 text-lavender rounded-full px-2 py-0.5">
                          Primary
                        </span>
                      )}
                      {!loc.is_active && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-50 text-red-500 rounded-full px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-mist mt-1">
                      {[loc.address, loc.city, loc.state, loc.zip]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingLocationId(isEditing ? null : loc.id)}
                      className="text-xs text-lavender hover:underline"
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                    <button
                      onClick={async () => {
                        const next = !loc.is_active;
                        await toggleLocationActive(loc.id, next);
                        setLocations((prev) =>
                          prev.map((l) => (l.id === loc.id ? { ...l, is_active: next } : l))
                        );
                      }}
                      className={`text-xs ${loc.is_active ? "text-red-400 hover:text-red-600" : "text-green-500 hover:text-green-700"}`}
                    >
                      {loc.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4">
                    <LocationForm
                      initial={loc}
                      onSave={async (data) => {
                        const result = await upsertLocation({ id: loc.id, ...data });
                        if (result.success) {
                          setEditingLocationId(null);
                          window.location.reload();
                        }
                      }}
                      onCancel={() => setEditingLocationId(null)}
                    />
                  </div>
                )}
              </div>

              {/* Rooms sub-section */}
              <div className="border-t border-silver/60 bg-cloud/30 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-mist uppercase tracking-wide">
                    Rooms ({locRooms.length})
                  </p>
                  <button
                    onClick={() =>
                      setAddingRoomForLocation(
                        addingRoomForLocation === loc.id ? null : loc.id
                      )
                    }
                    className="text-xs text-lavender hover:underline"
                  >
                    {addingRoomForLocation === loc.id ? "Cancel" : "+ Add Room"}
                  </button>
                </div>

                {addingRoomForLocation === loc.id && (
                  <RoomForm
                    locationId={loc.id}
                    onSave={async (room) => {
                      const result = await upsertRoom(room);
                      if (result.success) {
                        setAddingRoomForLocation(null);
                        window.location.reload();
                      }
                    }}
                    onCancel={() => setAddingRoomForLocation(null)}
                  />
                )}

                {locRooms.length === 0 && (
                  <p className="text-xs text-mist">No rooms configured.</p>
                )}

                <div className="space-y-1.5">
                  {locRooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between rounded-lg bg-white border border-silver/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: room.color_hex ?? "#9C8BBF" }}
                        />
                        <span className="text-sm text-charcoal font-medium">
                          {room.name}
                        </span>
                        {room.capacity && (
                          <span className="text-xs text-mist">
                            Cap: {room.capacity}
                          </span>
                        )}
                        {room.notes && (
                          <span className="text-xs text-mist truncate max-w-[150px]">
                            {room.notes}
                          </span>
                        )}
                        {!room.is_active && (
                          <span className="text-[10px] bg-red-50 text-red-500 rounded-full px-1.5 py-0.5">
                            Inactive
                          </span>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          const next = !room.is_active;
                          await toggleRoomActive(room.id, next);
                          setRooms((prev) =>
                            prev.map((r) => (r.id === room.id ? { ...r, is_active: next } : r))
                          );
                        }}
                        className={`text-xs ${room.is_active ? "text-red-400 hover:text-red-600" : "text-green-500 hover:text-green-700"}`}
                      >
                        {room.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Location Form ───────────────────────────────────────
function LocationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Location;
  onSave: (data: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    is_primary?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [zip, setZip] = useState(initial?.zip ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-silver bg-white p-4 space-y-3 mb-4">
      <div>
        <label className="block text-xs font-medium text-charcoal mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Studio location name"
          className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-charcoal mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">State</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">ZIP</label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
        />
        <span className="text-sm text-charcoal">Primary location</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => {
            if (!name.trim()) return;
            setSaving(true);
            await onSave({ name, address, city, state, zip, is_primary: isPrimary });
            setSaving(false);
          }}
          disabled={saving || !name.trim()}
          className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-5 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : initial ? "Update Location" : "Add Location"}
        </button>
        <button
          onClick={onCancel}
          className="h-9 rounded-lg border border-silver text-sm text-mist px-4 hover:text-charcoal transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Room Form ───────────────────────────────────────────
function RoomForm({
  locationId,
  onSave,
  onCancel,
}: {
  locationId: string;
  onSave: (data: {
    name: string;
    capacity?: number;
    color_hex?: string;
    location_id: string;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [colorHex, setColorHex] = useState("#9C8BBF");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-silver bg-white p-4 space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">Room Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Studio 1"
            className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal mb-1">Capacity</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="20"
            className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="block text-xs font-medium text-charcoal">Color</label>
        <input
          type="color"
          value={colorHex}
          onChange={(e) => setColorHex(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-gray-200"
        />
        <input
          type="text"
          value={colorHex}
          onChange={(e) => setColorHex(e.target.value)}
          className="w-24 h-9 text-xs border border-silver rounded-lg px-2 font-mono text-charcoal focus:border-lavender focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-charcoal mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => {
            if (!name.trim()) return;
            setSaving(true);
            await onSave({
              name,
              capacity: capacity ? parseInt(capacity) : undefined,
              color_hex: colorHex,
              location_id: locationId,
              notes: notes || undefined,
            });
            setSaving(false);
          }}
          disabled={saving || !name.trim()}
          className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-5 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Add Room"}
        </button>
        <button
          onClick={onCancel}
          className="h-9 rounded-lg border border-silver text-sm text-mist px-4 hover:text-charcoal transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── SECTION 3: Contact & Hours ──────────────────────────
function ContactSection() {
  return (
    <section>
      <h2 className="text-lg font-heading font-semibold text-charcoal mb-1">
        Contact & Hours
      </h2>
      <p className="text-sm text-slate mb-4">
        Business hours and contact information.
      </p>
      <div className="rounded-xl border border-silver bg-white p-6">
        <p className="text-sm text-mist">
          Business hours and contact info coming soon.
        </p>
        <p className="text-xs text-mist mt-2">
          Configure closure dates at{" "}
          <a href="/admin/settings/studio-calendar" className="text-lavender hover:underline">
            /admin/settings/studio-calendar
          </a>
        </p>
      </div>
    </section>
  );
}
