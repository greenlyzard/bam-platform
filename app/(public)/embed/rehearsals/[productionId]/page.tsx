import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export default async function EmbedRehearsalSchedulePage({
  params,
}: {
  params: Promise<{ productionId: string }>;
}) {
  const { productionId } = await params;
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  const { data: production } = await supabase
    .from("productions")
    .select("name")
    .eq("id", productionId)
    .single();

  const { data: rehearsals } = await supabase
    .from("rehearsals")
    .select("id, title, date, start_time, end_time, location, cast_groups, notes, is_cancelled")
    .eq("production_id", productionId)
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
    <div
      style={{
        fontFamily: "'Montserrat', sans-serif",
        maxWidth: 640,
        margin: "0 auto",
        padding: "1.5rem 1rem",
        color: "#2D2D2D",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Montserrat:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <h1
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "#2D2D2D",
          marginBottom: 4,
        }}
      >
        {production?.name ?? "Rehearsal Schedule"}
      </h1>
      <p style={{ fontSize: "0.875rem", color: "#999", marginBottom: "1.5rem" }}>
        Ballet Academy and Movement
      </p>

      {Object.keys(byDate).length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "#999", textAlign: "center", padding: "2rem 0" }}>
          No upcoming rehearsals scheduled.
        </p>
      ) : (
        Object.entries(byDate).map(([dateStr, items]) => {
          const d = new Date(dateStr + "T12:00:00");
          const dayName = DAYS[d.getDay()];
          const dateLabel = d.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          });

          return (
            <div key={dateStr} style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#9C8BBF",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {dayName}, {dateLabel}
              </h2>
              {(items ?? []).map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid #E5E5E5",
                    borderRadius: 12,
                    padding: "0.75rem 1rem",
                    marginBottom: 8,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{r.title}</div>
                  <div style={{ fontSize: "0.875rem", color: "#666", marginTop: 2 }}>
                    {formatTime(r.start_time)} – {formatTime(r.end_time)}
                    {r.location && ` · ${r.location}`}
                  </div>
                  {r.cast_groups.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {r.cast_groups.map((g: string) => (
                        <span
                          key={g}
                          style={{
                            display: "inline-block",
                            background: "rgba(156,139,191,0.12)",
                            color: "#6B5A99",
                            borderRadius: 999,
                            padding: "2px 8px",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.notes && (
                    <div style={{ fontSize: "0.75rem", color: "#999", marginTop: 4 }}>
                      {r.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })
      )}

      <p
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#CCC",
          marginTop: "2rem",
        }}
      >
        balletacademyandmovement.com
      </p>
    </div>
  );
}
