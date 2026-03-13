import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export default async function PortalRehearsalsPage() {
  await requireParent();
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  const { data: rehearsals } = await supabase
    .from("rehearsals")
    .select("id, title, date, start_time, end_time, location, cast_groups, notes, is_cancelled")
    .eq("tenant_id", tenant?.id ?? "")
    .gte("date", today)
    .eq("is_cancelled", false)
    .order("date")
    .order("start_time");

  // Group by date
  const byDate: Record<string, typeof rehearsals> = {};
  for (const r of rehearsals ?? []) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date]!.push(r);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Rehearsal Schedule
        </h1>
        <p className="mt-1 text-sm text-mist">
          Upcoming rehearsals for your dancers.
        </p>
      </div>

      {Object.keys(byDate).length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No upcoming rehearsals scheduled.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDate).map(([dateStr, items]) => {
            const d = new Date(dateStr + "T12:00:00");
            const dayName = DAYS[d.getDay()];
            const dateLabel = d.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            });

            return (
              <div key={dateStr}>
                <h3 className="mb-2 text-sm font-semibold text-charcoal">
                  {dayName}, {dateLabel}
                </h3>
                <div className="space-y-2">
                  {(items ?? []).map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-silver bg-white p-4"
                    >
                      <h4 className="font-medium text-charcoal">{r.title}</h4>
                      <p className="text-sm text-slate mt-0.5">
                        {formatTime(r.start_time)} – {formatTime(r.end_time)}
                        <span className="text-mist"> · {durationMinutes(r.start_time, r.end_time)} min</span>
                        {r.location && (
                          <span className="text-mist"> · {r.location}</span>
                        )}
                      </p>
                      {r.cast_groups.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.cast_groups.map((g: string) => (
                            <span
                              key={g}
                              className="rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.notes && (
                        <p className="mt-1.5 text-xs text-mist">{r.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
