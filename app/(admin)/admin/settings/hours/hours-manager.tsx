"use client";

import { useState } from "react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Location {
  id: string;
  name: string;
  is_primary: boolean;
  is_active: boolean;
}

interface HourRow {
  id?: string;
  location_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  notes: string | null;
}

export function HoursManager({
  locations,
  initialHours,
  tenantId,
}: {
  locations: Location[];
  initialHours: HourRow[];
  tenantId: string;
}) {
  const [hours, setHours] = useState<HourRow[]>(() => {
    // Ensure all 7 days exist for each location
    const result: HourRow[] = [];
    for (const loc of locations) {
      for (let dow = 0; dow < 7; dow++) {
        const existing = initialHours.find(
          (h) => h.location_id === loc.id && h.day_of_week === dow
        );
        result.push(
          existing ?? {
            location_id: loc.id,
            day_of_week: dow,
            is_open: false,
            open_time: null,
            close_time: null,
            notes: null,
          }
        );
      }
    }
    return result;
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  function getHours(locationId: string): HourRow[] {
    return hours
      .filter((h) => h.location_id === locationId)
      .sort((a, b) => a.day_of_week - b.day_of_week);
  }

  function updateHour(locationId: string, dow: number, field: string, value: unknown) {
    setHours((prev) =>
      prev.map((h) =>
        h.location_id === locationId && h.day_of_week === dow
          ? { ...h, [field]: value }
          : h
      )
    );
  }

  async function saveLocation(locationId: string) {
    setSaving(locationId);
    const locHours = getHours(locationId).map((h) => ({
      day_of_week: h.day_of_week,
      is_open: h.is_open,
      open_time: h.is_open ? h.open_time : null,
      close_time: h.is_open ? h.close_time : null,
      notes: h.notes || null,
    }));

    const res = await fetch("/api/admin/studio-settings/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, tenantId, hours: locHours }),
    });

    setSaving(null);
    if (res.ok) {
      setToast("Saved");
      setTimeout(() => setToast(""), 2000);
    } else {
      setToast("Error saving");
    }
  }

  function copyHoursToAll(sourceLocationId: string) {
    const source = getHours(sourceLocationId);
    setHours((prev) =>
      prev.map((h) => {
        if (h.location_id === sourceLocationId) return h;
        const src = source.find((s) => s.day_of_week === h.day_of_week);
        if (!src) return h;
        return {
          ...h,
          is_open: src.is_open,
          open_time: src.open_time,
          close_time: src.close_time,
          notes: src.notes,
        };
      })
    );
    setToast("Hours copied — save each location to apply");
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{toast}</div>
      )}

      {locations.map((loc) => (
        <section key={loc.id}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-heading font-semibold text-charcoal">{loc.name}</h2>
              {loc.is_primary && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-lavender/10 text-lavender rounded-full px-2 py-0.5">
                  Primary
                </span>
              )}
            </div>
            {locations.length > 1 && (
              <button
                onClick={() => copyHoursToAll(loc.id)}
                className="text-xs text-lavender hover:underline"
              >
                Copy to all locations
              </button>
            )}
          </div>

          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {getHours(loc.id).map((h) => (
              <div
                key={h.day_of_week}
                className={`flex items-center gap-4 px-4 py-3 ${!h.is_open ? "bg-cloud/30" : ""}`}
              >
                {/* Day name */}
                <span className="w-24 text-sm font-medium text-charcoal shrink-0">
                  {DAY_NAMES[h.day_of_week]}
                </span>

                {/* Open/Closed toggle */}
                <button
                  onClick={() => updateHour(loc.id, h.day_of_week, "is_open", !h.is_open)}
                  className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${
                    h.is_open ? "bg-success" : "bg-silver"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      h.is_open ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>

                {h.is_open ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.open_time ?? ""}
                        onChange={(e) => updateHour(loc.id, h.day_of_week, "open_time", e.target.value)}
                        className="h-8 rounded border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                      />
                      <span className="text-xs text-mist">to</span>
                      <input
                        type="time"
                        value={h.close_time ?? ""}
                        onChange={(e) => updateHour(loc.id, h.day_of_week, "close_time", e.target.value)}
                        className="h-8 rounded border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={h.notes ?? ""}
                      onChange={(e) => updateHour(loc.id, h.day_of_week, "notes", e.target.value)}
                      placeholder="Notes..."
                      className="flex-1 h-8 rounded border border-silver px-2 text-xs text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none"
                    />
                  </>
                ) : (
                  <span className="text-sm text-mist">Closed</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => saveLocation(loc.id)}
            disabled={saving === loc.id}
            className="mt-3 h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-5 disabled:opacity-50 transition-colors"
          >
            {saving === loc.id ? "Saving..." : "Save Hours"}
          </button>
        </section>
      ))}

      {locations.length === 0 && (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No active locations. Add a location in Studio Profile settings first.</p>
        </div>
      )}
    </div>
  );
}
