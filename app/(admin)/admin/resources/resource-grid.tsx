"use client";

import type { UtilizationGrid } from "@/lib/resources/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  occupied: "bg-lavender/30 border-lavender",
  dead_time: "bg-white border-silver",
  closed: "bg-cloud/50 border-transparent",
  rental_eligible: "bg-warning/10 border-warning/30",
};

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export function ResourceGrid({ grid }: { grid: UtilizationGrid }) {
  if (grid.rooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
        No bookable rooms configured.
      </div>
    );
  }

  // Collect all unique hours across all rooms
  const allHours = new Set<number>();
  for (const room of grid.rooms) {
    for (const slot of room.slots) {
      allHours.add(slot.hour);
    }
  }
  const hours = [...allHours].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {grid.rooms.map((roomUtil) => (
        <div
          key={roomUtil.room.id}
          className="rounded-xl border border-silver bg-white p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-charcoal">
                {roomUtil.room.name}
              </h3>
              <p className="text-xs text-slate">
                Capacity: {roomUtil.room.capacity ?? "—"} students
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-heading font-semibold text-charcoal">
                {roomUtil.utilizationPercent}%
              </p>
              <p className="text-xs text-mist">utilized</p>
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Day headers */}
              <div className="grid grid-cols-[4rem_repeat(7,1fr)] gap-0.5 mb-0.5">
                <div /> {/* empty corner */}
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="text-center text-xs font-medium text-slate py-1"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Hour rows */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[4rem_repeat(7,1fr)] gap-0.5 mb-0.5"
                >
                  <div className="text-xs text-mist text-right pr-2 py-1">
                    {formatHour(hour)}
                  </div>
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const slot = roomUtil.slots.find(
                      (s) => s.dayOfWeek === dayIdx && s.hour === hour
                    );
                    const status = slot?.status ?? "closed";
                    return (
                      <div
                        key={dayIdx}
                        className={`rounded border py-1 px-1.5 text-xs min-h-[2rem] flex items-center justify-center ${STATUS_COLORS[status] ?? "bg-cloud border-transparent"}`}
                        title={
                          slot?.classInstance?.className ??
                          slot?.rental?.renter_name ??
                          status
                        }
                      >
                        {slot?.classInstance?.className ? (
                          <span className="truncate text-[10px] text-charcoal">
                            {slot.classInstance.className}
                          </span>
                        ) : slot?.rental ? (
                          <span className="truncate text-[10px] text-warning">
                            Rental
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-slate">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-lavender/30 border border-lavender" />
              Occupied
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-white border border-silver" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-warning/10 border border-warning/30" />
              Rental eligible
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-cloud/50" />
              Closed
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
