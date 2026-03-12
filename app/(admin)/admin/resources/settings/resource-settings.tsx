"use client";

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

interface StudioHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface RoomInfo {
  id: string;
  name: string;
  capacity: number | null;
  hourly_rate_private: number | null;
}

export function ResourceSettings({
  hours,
  rooms,
}: {
  hours: StudioHour[];
  rooms: RoomInfo[];
}) {
  return (
    <div className="space-y-6">
      {/* Studio Hours */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Studio Open Hours
        </h2>
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {DAY_NAMES.map((name, idx) => {
            const dayHours = hours.find((h) => h.day_of_week === idx);
            return (
              <div
                key={idx}
                className="px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-charcoal w-28">
                  {name}
                </span>
                {dayHours?.is_closed ? (
                  <span className="text-sm text-mist">Closed</span>
                ) : dayHours ? (
                  <span className="text-sm text-slate">
                    {formatTime(dayHours.open_time)} –{" "}
                    {formatTime(dayHours.close_time)}
                  </span>
                ) : (
                  <span className="text-sm text-mist">Not configured</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-mist">
          Studio hours are used to calculate room utilization and identify
          rental-eligible time blocks. Contact support to modify.
        </p>
      </section>

      {/* Room Rates */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Room Rental Rates
        </h2>
        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
            No bookable rooms configured.
          </div>
        ) : (
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-charcoal">
                    {room.name}
                  </span>
                  <span className="text-xs text-mist ml-2">
                    Cap: {room.capacity ?? "—"}
                  </span>
                </div>
                <span className="text-sm text-slate">
                  {room.hourly_rate_private != null
                    ? `$${Number(room.hourly_rate_private).toFixed(2)}/hr`
                    : "Not set"}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-mist">
          Room rates are used to calculate estimated rental revenue in AI
          recommendations. Edit rates in the Rooms settings.
        </p>
      </section>

      {/* Recommendation Thresholds */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Recommendation Thresholds
        </h2>
        <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal">
                Low enrollment threshold
              </p>
              <p className="text-xs text-mist">
                Classes below this fill percentage trigger recommendations
              </p>
            </div>
            <span className="text-sm font-medium text-charcoal">50%</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal">
                Minimum rental block duration
              </p>
              <p className="text-xs text-mist">
                Dead time blocks shorter than this are not flagged for rental
              </p>
            </div>
            <span className="text-sm font-medium text-charcoal">
              60 minutes
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal">
                Teacher high workload threshold
              </p>
              <p className="text-xs text-mist">
                Teachers at or above this percentage trigger alerts
              </p>
            </div>
            <span className="text-sm font-medium text-charcoal">90%</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal">
                Teacher low workload threshold
              </p>
              <p className="text-xs text-mist">
                Teachers below this percentage are flagged as underloaded
              </p>
            </div>
            <span className="text-sm font-medium text-charcoal">40%</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
