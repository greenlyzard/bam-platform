"use client";

import { useState, useTransition, useRef } from "react";
import {
  toggleLocationActive,
  toggleResourceActive,
  deleteResource,
  updateResourceOrder,
} from "./actions";
import { LocationDrawer } from "./location-drawer";
import { ResourceDrawer } from "./resource-drawer";

interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_primary: boolean;
  is_active: boolean;
}

interface Resource {
  id: string;
  name: string;
  type: string;
  location_id: string | null;
  is_portable: boolean;
  color: string;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

const COLOR_DOT_MAP: Record<string, string> = {
  lavender: "bg-lavender",
  gold: "bg-gold",
  info: "bg-info",
  success: "bg-success",
  error: "bg-error",
  slate: "bg-slate",
};

const TYPE_LABELS: Record<string, string> = {
  room: "Rooms",
  equipment: "Equipment",
  other: "Other",
};

const TYPE_ORDER = ["room", "equipment", "other"];

function formatAddress(loc: Location): string {
  const parts: string[] = [];
  if (loc.address) parts.push(loc.address);
  const cityStateZip: string[] = [];
  if (loc.city) cityStateZip.push(loc.city);
  if (loc.state) cityStateZip.push(loc.state);
  const csz = cityStateZip.join(", ");
  if (csz && loc.zip) {
    parts.push(`${csz} ${loc.zip}`);
  } else if (csz) {
    parts.push(csz);
  } else if (loc.zip) {
    parts.push(loc.zip);
  }
  return parts.join(", ");
}

export function ResourceManagement({
  locations: initialLocations,
  resources: initialResources,
  tenantId,
}: {
  locations: Location[];
  resources: Resource[];
  tenantId: string;
}) {
  const [locations, setLocations] = useState(initialLocations);
  const [resources, setResources] = useState(initialResources);
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | undefined>();
  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | undefined>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const dragItemRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const dragTypeRef = useRef<string | null>(null);

  const locationMap = new Map(locations.map((l) => [l.id, l]));

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Location handlers ──────────────────────────────────

  function openNewLocation() {
    setEditingLocation(undefined);
    setLocationDrawerOpen(true);
  }

  function openEditLocation(location: Location) {
    setEditingLocation(location);
    setLocationDrawerOpen(true);
  }

  function handleLocationSaved() {
    showToast(editingLocation ? "Location updated" : "Location created");
  }

  function handleToggleLocationActive(locationId: string, value: boolean) {
    setLocations((prev) => prev.map((l) => l.id === locationId ? { ...l, is_active: value } : l));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("locationId", locationId);
      fd.set("isActive", String(value));
      const result = await toggleLocationActive(fd);
      if (result?.error) {
        setLocations((prev) => prev.map((l) => l.id === locationId ? { ...l, is_active: !value } : l));
        showToast(result.error);
      }
    });
  }

  // ── Resource handlers ──────────────────────────────────

  function openNewResource() {
    setEditingResource(undefined);
    setResourceDrawerOpen(true);
  }

  function openEditResource(resource: Resource) {
    setEditingResource(resource);
    setResourceDrawerOpen(true);
  }

  function handleResourceSaved() {
    showToast(editingResource ? "Resource updated" : "Resource created");
  }

  function handleToggleResourceActive(resourceId: string, value: boolean) {
    setResources((prev) => prev.map((r) => r.id === resourceId ? { ...r, is_active: value } : r));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("resourceId", resourceId);
      fd.set("isActive", String(value));
      const result = await toggleResourceActive(fd);
      if (result?.error) {
        setResources((prev) => prev.map((r) => r.id === resourceId ? { ...r, is_active: !value } : r));
        showToast(result.error);
      }
    });
  }

  function handleDeleteResource(resourceId: string) {
    setDeleteError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("resourceId", resourceId);
      const result = await deleteResource(fd);
      if (result?.error) {
        setDeleteError(result.error);
      } else {
        setResources((prev) => prev.filter((r) => r.id !== resourceId));
        setConfirmDeleteId(null);
        showToast("Resource deleted");
      }
    });
  }

  // ── Drag and drop reorder ──────────────────────────────

  function handleDragStart(resourceId: string, type: string) {
    dragItemRef.current = resourceId;
    dragTypeRef.current = type;
  }

  function handleDragOver(e: React.DragEvent, resourceId: string) {
    e.preventDefault();
    dragOverRef.current = resourceId;
  }

  function handleDrop(type: string) {
    const dragId = dragItemRef.current;
    const dropId = dragOverRef.current;
    if (!dragId || !dropId || dragId === dropId) return;
    if (dragTypeRef.current !== type) return;

    const typeResources = resources
      .filter((r) => r.type === type)
      .sort((a, b) => a.sort_order - b.sort_order);

    const dragIdx = typeResources.findIndex((r) => r.id === dragId);
    const dropIdx = typeResources.findIndex((r) => r.id === dropId);
    if (dragIdx === -1 || dropIdx === -1) return;

    const reordered = [...typeResources];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    const updatedGroup = reordered.map((r, i) => ({ ...r, sort_order: i }));
    const updatedIds = new Map(updatedGroup.map((r) => [r.id, r]));

    setResources((prev) =>
      prev.map((r) => updatedIds.has(r.id) ? updatedIds.get(r.id)! : r)
    );

    startTransition(async () => {
      for (const r of updatedGroup) {
        const fd = new FormData();
        fd.set("resourceId", r.id);
        fd.set("sortOrder", String(r.sort_order));
        await updateResourceOrder(fd);
      }
    });

    dragItemRef.current = null;
    dragOverRef.current = null;
    dragTypeRef.current = null;
  }

  // ── Group resources by type ────────────────────────────

  const groupedResources = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type] ?? type,
    items: resources
      .filter((r) => r.type === type)
      .sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] bg-charcoal text-white text-sm px-4 py-2.5 rounded-lg shadow-lg animate-in fade-in-0">
          {toast}
        </div>
      )}

      {/* ── Section 1: Studio Locations ───────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold text-charcoal">Studio Locations</h2>
          <button
            onClick={openNewLocation}
            className="h-8 rounded-lg border border-silver text-charcoal hover:bg-cloud font-medium text-sm px-4 transition-colors"
          >
            + Add Location
          </button>
        </div>

        {locations.length === 0 ? (
          <p className="text-sm text-slate py-6 text-center">No locations configured.</p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => {
              const address = formatAddress(loc);
              return (
                <div
                  key={loc.id}
                  className="rounded-xl border border-silver bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-charcoal">{loc.name}</span>
                        {loc.is_primary && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-lavender/10 text-lavender-dark">
                            Primary
                          </span>
                        )}
                      </div>
                      {address && (
                        <p className="text-xs text-slate mt-0.5">{address}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Active toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={loc.is_active}
                            onChange={(e) => handleToggleLocationActive(loc.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </span>
                        <span className="text-xs text-slate">Active</span>
                      </label>

                      <button
                        onClick={() => openEditLocation(loc)}
                        className="text-xs text-lavender hover:text-lavender-dark font-medium px-2 py-1 rounded transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Studio Resources ───────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold text-charcoal">Studio Resources</h2>
          <button
            onClick={openNewResource}
            className="h-8 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-4 transition-colors"
          >
            + Add Resource
          </button>
        </div>

        {groupedResources.length === 0 ? (
          <p className="text-sm text-slate py-6 text-center">No resources configured.</p>
        ) : (
          groupedResources.map((group) => (
            <div key={group.type}>
              <h3 className="text-sm font-semibold text-charcoal mb-2 mt-4">
                {group.label} ({group.items.length})
              </h3>

              <div className="space-y-2">
                {group.items.map((resource) => {
                  const dotClass = COLOR_DOT_MAP[resource.color] ?? "bg-slate";
                  const loc = resource.location_id ? locationMap.get(resource.location_id) : null;
                  const isDeleting = confirmDeleteId === resource.id;

                  return (
                    <div
                      key={resource.id}
                      draggable
                      onDragStart={() => handleDragStart(resource.id, resource.type)}
                      onDragOver={(e) => handleDragOver(e, resource.id)}
                      onDrop={() => handleDrop(resource.type)}
                      className="rounded-xl border border-silver bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {/* Drag handle */}
                        <span className="text-mist hover:text-slate cursor-grab active:cursor-grabbing select-none text-lg leading-none">
                          ⠿
                        </span>

                        {/* Color dot */}
                        <span className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />

                        {/* Name */}
                        <span className="font-medium text-charcoal">{resource.name}</span>

                        {/* Location or Portable badge */}
                        {resource.is_portable ? (
                          <span className="bg-info/10 text-info text-xs rounded-full px-2 py-0.5 font-medium">
                            Portable
                          </span>
                        ) : loc ? (
                          <span className="text-xs text-slate">{loc.name}</span>
                        ) : null}

                        {/* Capacity (rooms only) */}
                        {resource.type === "room" && resource.capacity != null && (
                          <span className="text-xs text-slate">Cap: {resource.capacity}</span>
                        )}

                        <div className="flex items-center gap-3 ml-auto shrink-0">
                          {/* Active toggle */}
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <span className="relative inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={resource.is_active}
                                onChange={(e) => handleToggleResourceActive(resource.id, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                            </span>
                            <span className="text-xs text-slate">Active</span>
                          </label>

                          <button
                            onClick={() => openEditResource(resource)}
                            className="text-xs text-lavender hover:text-lavender-dark font-medium px-2 py-1 rounded transition-colors"
                          >
                            Edit
                          </button>

                          {!isDeleting ? (
                            <button
                              onClick={() => { setConfirmDeleteId(resource.id); setDeleteError(""); }}
                              className="text-xs text-error hover:text-error/80 font-medium px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-xs text-slate">Delete?</span>
                              <button
                                onClick={() => handleDeleteResource(resource.id)}
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
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Drawers ───────────────────────────────────────── */}
      {locationDrawerOpen && (
        <LocationDrawer
          location={editingLocation}
          tenantId={tenantId}
          onClose={() => setLocationDrawerOpen(false)}
          onSaved={handleLocationSaved}
        />
      )}

      {resourceDrawerOpen && (
        <ResourceDrawer
          resource={editingResource}
          locations={locations}
          tenantId={tenantId}
          onClose={() => setResourceDrawerOpen(false)}
          onSaved={handleResourceSaved}
        />
      )}
    </div>
  );
}
