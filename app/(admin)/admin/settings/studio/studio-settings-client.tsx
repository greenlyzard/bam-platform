"use client";

import { useEffect, useState } from "react";
import {
  updateStudioIdentity,
  upsertLocation,
  upsertRoom,
  toggleLocationActive,
  toggleRoomActive,
  getRoomReferenceCounts,
  deleteRoom,
} from "./actions";
import { SimpleSelect } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LOCATION_TYPE_OPTIONS, type LocationType } from "@/lib/locations/validate";
import {
  describeRoomReferences,
  type RoomReferenceCounts,
} from "@/lib/rooms/references";

interface StudioSettings {
  id: string;
  studio_name: string;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  app_icon_url: string | null;
  student_term_singular: string | null;
  student_term_plural: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Location {
  id: string;
  name: string;
  /**
   * Optional short label. Null means the location has no short form and callers
   * fall back to `name` — see the column comment in
   * 20260731000001_location_abbreviation.sql. Declared optional (not just
   * nullable) because the generated types don't carry this column until they're
   * regenerated after the migration is pushed; tighten to `string | null` then.
   */
  abbreviation?: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
  location_type: LocationType;
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

/**
 * Sentinel for the room Location dropdown. `rooms.location_id` is nullable and
 * SimpleSelect cannot hold null, so null round-trips through this value.
 */
const UNASSIGNED_LOCATION = "__none__";

/**
 * Which rooms the Rooms lists show. `rooms.is_active` is the archive flag —
 * there is no separate archived column — so Archived is simply is_active false.
 */
type RoomView = "active" | "archived";

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
  const [logoLightUrl, setLogoLightUrl] = useState(settings?.logo_light_url ?? settings?.logo_url ?? "");
  const [logoDarkUrl, setLogoDarkUrl] = useState(settings?.logo_dark_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(settings?.favicon_url ?? "");
  const [studentTermSingular, setStudentTermSingular] = useState(settings?.student_term_singular ?? "Student");
  const [studentTermPlural, setStudentTermPlural] = useState(settings?.student_term_plural ?? "Students");
  const [phone, setPhone] = useState(settings?.phone ?? "");
  const [email, setEmail] = useState(settings?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  async function handleUpload(file: File, type: string) {
    setUploading(type);
    const form = new FormData();
    form.set("file", file);
    form.set("type", type);
    const res = await fetch("/api/admin/studio/logo", { method: "POST", body: form });
    const data = await res.json();
    setUploading(null);
    if (data.url) {
      if (type === "logo_light") setLogoLightUrl(data.url);
      else if (type === "logo_dark") setLogoDarkUrl(data.url);
      else if (type === "favicon") setFaviconUrl(data.url);
      setToast("Uploaded");
      setTimeout(() => setToast(""), 2000);
    } else {
      setToast(data.error ?? "Upload failed");
    }
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateStudioIdentity({
      studio_name: studioName,
      logo_light_url: logoLightUrl || null,
      logo_dark_url: logoDarkUrl || null,
      favicon_url: faviconUrl || null,
      student_term_singular: studentTermSingular || "Student",
      student_term_plural: studentTermPlural || "Students",
      phone: phone || null,
      email: email || null,
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

        {/* Contact — shown on the public enrollment page footer */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Contact
          </label>
          <p className="text-xs text-mist mb-2">
            Shown on the public enrollment page footer.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-xs text-mist mb-1 block">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(949) 229-0846"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-mist mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dance@bamsocal.com"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Light Logo */}
        <BrandingUploadField
          label="Light Logo"
          hint="Used on dark backgrounds, portal header"
          url={logoLightUrl}
          accept=".png,.jpg,.jpeg,.svg"
          uploading={uploading === "logo_light"}
          onFileSelect={(file) => handleUpload(file, "logo_light")}

          previewClassName="h-12 object-contain"
        />

        {/* Dark Logo */}
        <BrandingUploadField
          label="Dark Logo"
          hint="Used on light backgrounds, emails, documents"
          url={logoDarkUrl}
          accept=".png,.jpg,.jpeg,.svg"
          uploading={uploading === "logo_dark"}
          onFileSelect={(file) => handleUpload(file, "logo_dark")}

          previewClassName="h-12 object-contain"
        />

        {/* Favicon */}
        <BrandingUploadField
          label="Favicon"
          hint="Browser tab icon, 32x32 or 64x64 recommended"
          url={faviconUrl}
          accept=".ico,.png"
          uploading={uploading === "favicon"}
          onFileSelect={(file) => handleUpload(file, "favicon")}

          previewClassName="w-8 h-8 object-contain"
        />

        {/* Student terminology */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-charcoal">
            What do you call your students?
          </label>
          <p className="text-xs text-mist">
            Used throughout the platform and parent portal.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-xs text-mist mb-1 block">Singular</label>
              <input
                type="text"
                value={studentTermSingular}
                onChange={(e) => setStudentTermSingular(e.target.value)}
                placeholder="Student"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-mist mb-1 block">Plural</label>
              <input
                type="text"
                value={studentTermPlural}
                onChange={(e) => setStudentTermPlural(e.target.value)}
                placeholder="Students"
                className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-mist">
            Examples: Student/Students, Dancer/Dancers, Athlete/Athletes, Member/Members
          </p>
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

// ── Branding Upload Field ────────────────────────────────
function BrandingUploadField({
  label,
  hint,
  url,
  accept,
  uploading,
  onFileSelect,
  previewClassName,
}: {
  label: string;
  hint: string;
  url: string;
  accept: string;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  previewClassName: string;
}) {
  const filename = url ? url.split("/").pop()?.split("?")[0] ?? "" : "";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-charcoal">{label}</label>
      {url && (
        <div className="flex items-center gap-3">
          <div className={label === "Light Logo" ? "bg-gray-900 rounded p-2 inline-block" : ""}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className={previewClassName} />
          </div>
          <span className="text-xs text-mist truncate max-w-48">{filename}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="cursor-pointer px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
          {url ? "Replace" : "Upload"} {label}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
            }}
          />
        </label>
      </div>
      {uploading && <p className="text-xs text-lavender">Uploading...</p>}
      <p className="text-xs text-mist">{hint}</p>
    </div>
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
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomView, setRoomView] = useState<RoomView>("active");

  const showArchived = roomView === "archived";
  const activeRoomCount = rooms.filter((r) => r.is_active).length;
  const archivedRoomCount = rooms.length - activeRoomCount;

  // Every rooms list on this page — each location card and Unassigned — draws
  // from the selected view, so a room is never in two places at once.
  const visibleRooms = rooms.filter((r) => r.is_active !== showArchived);

  // Rooms with no location_id belong to no card above, so without their own
  // section they are invisible and unreachable in this UI. All three retired
  // orphan rooms live here, archived.
  const unassignedRooms = visibleRooms.filter((r) => r.location_id === null);

  function selectRoomView(view: RoomView) {
    setRoomView(view);
    // Any open form belongs to a row the other view does not show.
    setAddingRoomForLocation(null);
    setEditingRoomId(null);
  }

  function toggleRoom(room: Room) {
    return async () => {
      const next = !room.is_active;
      await toggleRoomActive(room.id, next);
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, is_active: next } : r))
      );
    };
  }

  function removeRoom(id: string) {
    return () => {
      setRooms((prev) => prev.filter((r) => r.id !== id));
      setEditingRoomId((prev) => (prev === id ? null : prev));
    };
  }

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

      {/* One control for every rooms list below. Both counts are always shown so
          an empty Archived view reads as empty, not broken. */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold text-mist uppercase tracking-wide">
          Rooms
        </span>
        <div className="inline-flex rounded-lg border border-silver bg-white p-0.5">
          <RoomViewTab
            label="Active"
            count={activeRoomCount}
            selected={!showArchived}
            onSelect={() => selectRoomView("active")}
          />
          <RoomViewTab
            label="Archived"
            count={archivedRoomCount}
            selected={showArchived}
            onSelect={() => selectRoomView("archived")}
          />
        </div>
      </div>

      {showArchived && archivedRoomCount === 0 && (
        <p className="text-xs text-mist mb-4">
          No archived rooms. Archiving a room takes it out of scheduling without
          touching the classes and occurrences that already happened in it.
        </p>
      )}

      <div className="space-y-4">
        {locations.map((loc) => {
          const locRooms = visibleRooms.filter((r) => r.location_id === loc.id);
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
                    {showArchived ? "Archived Rooms" : "Rooms"} ({locRooms.length})
                  </p>
                  {/* A new room is created active, so it would vanish on save
                      from the Archived view. Offer it only where it lands. */}
                  {!showArchived && (
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
                  )}
                </div>

                {addingRoomForLocation === loc.id && (
                  <RoomForm
                    locationId={loc.id}
                    locations={locations}
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
                  <p className="text-xs text-mist">
                    {showArchived
                      ? "No archived rooms."
                      : "No rooms configured."}
                  </p>
                )}

                <div className="space-y-1.5">
                  {locRooms.map((room) => (
                    <RoomRow
                      key={room.id}
                      room={room}
                      locations={locations}
                      isEditing={editingRoomId === room.id}
                      onEditToggle={() =>
                        setEditingRoomId(editingRoomId === room.id ? null : room.id)
                      }
                      onToggleActive={toggleRoom(room)}
                      onDeleted={removeRoom(room.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Unassigned rooms — surfaced, never auto-assigned. Edit one and pick a
            Location to file it under a card above. */}
        {unassignedRooms.length > 0 && (
          <div className="rounded-xl border border-dashed border-silver bg-cloud/30 px-5 py-4">
            <div className="mb-3">
              <p className="text-xs font-semibold text-mist uppercase tracking-wide">
                {showArchived ? "Unassigned & Archived" : "Unassigned"} (
                {unassignedRooms.length})
              </p>
              <p className="text-xs text-mist mt-1">
                These rooms have no location. Edit a room to assign one.
              </p>
            </div>

            <div className="space-y-1.5">
              {unassignedRooms.map((room) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  locations={locations}
                  isEditing={editingRoomId === room.id}
                  onEditToggle={() =>
                    setEditingRoomId(editingRoomId === room.id ? null : room.id)
                  }
                  onToggleActive={toggleRoom(room)}
                  onDeleted={removeRoom(room.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Room View Tab ───────────────────────────────────────
function RoomViewTab({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
        selected
          ? "bg-lavender text-white"
          : "text-mist hover:text-charcoal"
      }`}
    >
      {label} ({count})
    </button>
  );
}

// ── Room Row ────────────────────────────────────────────
// Shared by the per-location cards and the Unassigned section so both get the
// same edit, archive, and delete affordances.
function RoomRow({
  room,
  locations,
  isEditing,
  onEditToggle,
  onToggleActive,
  onDeleted,
}: {
  room: Room;
  locations: Location[];
  isEditing: boolean;
  onEditToggle: () => void;
  onToggleActive: () => void;
  onDeleted: () => void;
}) {
  // `is_active` is the archive flag. An active room gets no delete affordance
  // at all — archive it first, which is the step that makes someone look at
  // what the room is still used for.
  const archived = !room.is_active;

  const [refs, setRefs] = useState<RoomReferenceCounts | null>(null);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reference counts come from the server. Every FK to rooms is
  // ON DELETE SET NULL, so a delete would succeed against a room with 27
  // occurrences behind it and quietly orphan all 27 — nothing here may guess.
  // An active room shows no reference line and no delete button, so it needs no
  // count. Rows are keyed by room id and the view filter unmounts a row the
  // moment it is archived or restored, so the counts never outlive their room.
  useEffect(() => {
    if (!archived) return;
    let cancelled = false;
    getRoomReferenceCounts(room.id).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setRefs(result.counts);
        setRefsError(null);
      } else {
        setRefs(null);
        setRefsError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [room.id, archived]);

  // Unknown counts are not zero counts.
  const deletable = refs !== null && refs.total === 0;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteRoom(room.id);
    setDeleting(false);
    if (result.success) {
      setConfirmOpen(false);
      onDeleted();
      return;
    }
    setDeleteError(result.error ?? "Delete failed.");
    // The server refused on a count this row did not have — go get the real one.
    const refreshed = await getRoomReferenceCounts(room.id);
    if (refreshed.success) setRefs(refreshed.counts);
  }

  return (
    <div className="rounded-lg bg-white border border-silver/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-4 h-4 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: room.color_hex ?? "#9C8BBF" }}
          />
          <span className="text-sm text-charcoal font-medium">{room.name}</span>
          {room.capacity && (
            <span className="text-xs text-mist">Cap: {room.capacity}</span>
          )}
          {room.notes && (
            <span className="text-xs text-mist truncate max-w-[150px]">
              {room.notes}
            </span>
          )}
          {archived && (
            <span className="text-[10px] bg-red-50 text-red-500 rounded-full px-1.5 py-0.5">
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEditToggle}
            className="text-xs text-lavender hover:underline"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={onToggleActive}
            className={`text-xs ${room.is_active ? "text-red-400 hover:text-red-600" : "text-green-500 hover:text-green-700"}`}
          >
            {room.is_active ? "Archive" : "Restore"}
          </button>
          {archived && (
            <button
              type="button"
              onClick={() => {
                setConfirmText("");
                setDeleteError(null);
                setConfirmOpen(true);
              }}
              disabled={!deletable}
              className="text-xs text-red-500 hover:text-red-700 disabled:text-mist disabled:cursor-not-allowed disabled:hover:text-mist"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Why Delete is or is not available, stated with the number. */}
      {archived && (
        <p className="text-xs text-mist mt-1.5 pl-6">
          {refsError
            ? `Could not check what uses this room (${refsError}) — delete unavailable.`
            : refs === null
              ? "Checking what uses this room…"
              : refs.total > 0
                ? `${describeRoomReferences(refs)} Cannot be deleted.`
                : "Not used by any class, scheduled occurrence, or schedule template."}
        </p>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {room.name}</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the room. It cannot be undone, and there
              is no way to restore it — restoring is only possible for archived
              rooms, and this one will no longer exist.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-charcoal">
              Type <span className="font-mono font-semibold">DELETE</span> to
              confirm.
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full h-9 rounded-lg border border-silver px-3 text-sm font-mono text-charcoal focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            {deleteError && (
              <p className="text-xs text-red-600">{deleteError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            {/* Exact match: case-sensitive, untrimmed. "delete" is not DELETE. */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || deleting || !deletable}
              className="rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting..." : "Delete Room"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isEditing && (
        <div className="mt-3">
          <RoomForm
            initial={room}
            locationId={room.location_id}
            locations={locations}
            onSave={async (data) => {
              const result = await upsertRoom({ id: room.id, ...data });
              if (result.success) {
                onEditToggle();
                window.location.reload();
              }
            }}
            onCancel={onEditToggle}
          />
        </div>
      )}
    </div>
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
    /** Empty input is sent as null, never "" — see upsertLocation. */
    abbreviation: string | null;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    is_primary?: boolean;
    location_type: LocationType;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [abbreviation, setAbbreviation] = useState(initial?.abbreviation ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [zip, setZip] = useState(initial?.zip ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [locationType, setLocationType] = useState<LocationType>(
    initial?.location_type ?? "studio"
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-silver bg-white p-4 space-y-3 mb-4">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
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
          <label className="block text-xs font-medium text-charcoal mb-1">
            Abbreviation
          </label>
          {/* maxLength mirrors the 12-char database constraint. */}
          <input
            type="text"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder="Optional"
            maxLength={12}
            className="w-full h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          />
        </div>
      </div>
      <p className="text-[11px] text-mist -mt-1">
        Optional short label, up to 12 characters (e.g. <span className="font-medium">SC</span>).
        Leave it blank and the full name is used.
      </p>
      <div>
        <label className="block text-xs font-medium text-charcoal mb-1">Type</label>
        <SimpleSelect
          value={locationType}
          onValueChange={(val) => setLocationType(val as LocationType)}
          options={LOCATION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          className="w-full"
        />
        <p className="text-[11px] text-mist mt-1">
          Only <span className="font-medium">Teaching studio</span> locations can be a class&apos;s home and appear in the parent catalog.
        </p>
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
            await onSave({
              name,
              abbreviation: abbreviation.trim() || null,
              address,
              city,
              state,
              zip,
              is_primary: isPrimary,
              location_type: locationType,
            });
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
  initial,
  locationId,
  locations,
  onSave,
  onCancel,
}: {
  initial?: Room;
  /**
   * The location this form opens under — the card that was clicked on create, or
   * null in the Unassigned section. `initial.location_id` wins when editing.
   */
  locationId: string | null;
  locations: Location[];
  onSave: (data: {
    name: string;
    capacity?: number;
    color_hex?: string;
    location_id: string | null;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : ""
  );
  const [colorHex, setColorHex] = useState(initial?.color_hex ?? "#9C8BBF");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [locId, setLocId] = useState<string | null>(
    initial ? initial.location_id : locationId
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-silver bg-white p-4 space-y-3 mb-3">
      <div>
        <label className="block text-xs font-medium text-charcoal mb-1">Location</label>
        <SimpleSelect
          value={locId ?? UNASSIGNED_LOCATION}
          onValueChange={(val) =>
            setLocId(val === UNASSIGNED_LOCATION ? null : val)
          }
          options={[
            { value: UNASSIGNED_LOCATION, label: "Unassigned" },
            ...locations.map((l) => ({ value: l.id, label: l.name })),
          ]}
          className="w-full"
        />
      </div>
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
              location_id: locId,
              notes: notes || undefined,
            });
            setSaving(false);
          }}
          disabled={saving || !name.trim()}
          className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-5 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : initial ? "Update Room" : "Add Room"}
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
