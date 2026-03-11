import { requireAdmin } from "@/lib/auth/guards";
import {
  getExpansionMarkets,
  getCompetitors,
  getEnrollmentStats,
  getCapacitySummary,
} from "@/lib/queries/admin";

const segmentLabels: Record<string, string> = {
  classical_ballet: "Classical Ballet",
  competition: "Competition",
  recreational: "Recreational",
  conservatory: "Conservatory",
  franchise: "Franchise",
  commercial: "Commercial",
};

const threatColors: Record<string, string> = {
  high: "bg-error/10 text-error",
  medium: "bg-warning/10 text-warning",
  low: "bg-cloud text-slate",
};

const statusColors: Record<string, string> = {
  ready: "bg-success/10 text-success",
  evaluating: "bg-warning/10 text-warning",
  research: "bg-info/10 text-info",
  opened: "bg-lavender/10 text-lavender-dark",
  passed: "bg-cloud text-mist",
};

export default async function ExpansionPage() {
  await requireAdmin();
  const [markets, competitors, stats, capacity] = await Promise.all([
    getExpansionMarkets(),
    getCompetitors(),
    getEnrollmentStats(),
    getCapacitySummary(),
  ]);

  // Expansion readiness indicators
  const isHighCapacity = capacity.capacityPercent >= 90;
  const hasWaitlist = stats.waitlistCount >= 15;
  const readinessIndicators = [
    {
      label: "Capacity ≥ 90%",
      met: isHighCapacity,
      value: `${capacity.capacityPercent}%`,
    },
    {
      label: "Waitlist ≥ 15",
      met: hasWaitlist,
      value: `${stats.waitlistCount} students`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Expansion Intelligence
        </h1>
        <p className="mt-1 text-sm text-slate">
          Market analysis, competitor tracking, and expansion readiness scoring.
        </p>
      </div>

      {/* Readiness Indicators */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Expansion Readiness
        </h2>
        <div className="rounded-xl border border-silver bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {readinessIndicators.map((ind) => (
              <div key={ind.label} className="flex items-center gap-3">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    ind.met
                      ? "bg-success/10 text-success"
                      : "bg-cloud text-mist"
                  }`}
                >
                  {ind.met ? "✓" : "—"}
                </span>
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {ind.label}
                  </p>
                  <p className="text-xs text-slate">{ind.value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-mist">
            Expansion is recommended when all indicators are met for 3+
            consecutive months and revenue targets are achieved.
          </p>
        </div>
      </section>

      {/* Target Markets */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Target Markets
        </h2>
        {markets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
            No expansion markets configured yet.
          </div>
        ) : (
          <div className="space-y-3">
            {markets.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-silver bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-charcoal">
                        {m.city}, {m.state}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[m.status] ?? "bg-cloud text-slate"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                    {m.region && (
                      <p className="text-xs text-mist">{m.region}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-center">
                    <ReadinessGauge score={m.readiness_score} />
                  </div>
                </div>

                {/* Market details */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {m.population && (
                    <div>
                      <p className="text-mist">Population</p>
                      <p className="font-medium text-charcoal">
                        {m.population.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {m.median_household_income && (
                    <div>
                      <p className="text-mist">Median Income</p>
                      <p className="font-medium text-charcoal">
                        ${m.median_household_income.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {m.families_with_children_pct != null && (
                    <div>
                      <p className="text-mist">Families w/ Children</p>
                      <p className="font-medium text-charcoal">
                        {m.families_with_children_pct}%
                      </p>
                    </div>
                  )}
                  {m.competitor_count != null && (
                    <div>
                      <p className="text-mist">Competitors</p>
                      <p className="font-medium text-charcoal">
                        {m.competitor_count}
                      </p>
                    </div>
                  )}
                  {m.drive_time_minutes && (
                    <div>
                      <p className="text-mist">Drive Time</p>
                      <p className="font-medium text-charcoal">
                        {m.drive_time_minutes} min
                      </p>
                    </div>
                  )}
                  {m.commercial_rent_per_sqft && (
                    <div>
                      <p className="text-mist">Rent/sqft</p>
                      <p className="font-medium text-charcoal">
                        ${Number(m.commercial_rent_per_sqft).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pros / Cons */}
                {((m.pros && m.pros.length > 0) ||
                  (m.cons && m.cons.length > 0)) && (
                  <div className="mt-3 pt-3 border-t border-silver grid gap-3 sm:grid-cols-2">
                    {m.pros && m.pros.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-success mb-1">
                          Pros
                        </p>
                        <ul className="text-xs text-slate space-y-0.5">
                          {m.pros.map((p: string, i: number) => (
                            <li key={i}>+ {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.cons && m.cons.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-error mb-1">
                          Cons
                        </p>
                        <ul className="text-xs text-slate space-y-0.5">
                          {m.cons.map((c: string, i: number) => (
                            <li key={i}>- {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {m.notes && (
                  <p className="mt-2 text-xs text-slate italic">{m.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Competitors */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Competitor Studios ({competitors.length})
        </h2>
        {competitors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
            No competitors tracked yet.
          </div>
        ) : (
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {competitors.map((c) => (
              <div key={c.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-charcoal">
                        {c.name}
                      </h4>
                      {c.threat_level && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            threatColors[c.threat_level] ?? "bg-cloud text-slate"
                          }`}
                        >
                          {c.threat_level}
                        </span>
                      )}
                      {c.segment && (
                        <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                          {segmentLabels[c.segment] ?? c.segment}
                        </span>
                      )}
                    </div>
                    {c.city && (
                      <p className="text-sm text-slate">
                        {c.city}
                        {c.state ? `, ${c.state}` : ""}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate">
                      {c.google_rating != null && (
                        <span>
                          Google: {c.google_rating}
                          {c.google_review_count != null &&
                            ` (${c.google_review_count})`}
                        </span>
                      )}
                      {c.yelp_rating != null && (
                        <span>
                          Yelp: {c.yelp_rating}
                          {c.yelp_review_count != null &&
                            ` (${c.yelp_review_count})`}
                        </span>
                      )}
                      {c.estimated_students && (
                        <span>~{c.estimated_students} students</span>
                      )}
                      {c.price_range && <span>{c.price_range}</span>}
                    </div>
                    {c.programs && c.programs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.programs.map((p: string) => (
                          <span
                            key={p}
                            className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-lavender hover:text-lavender-dark"
                    >
                      Website
                    </a>
                  )}
                </div>
                {/* Strengths / Weaknesses */}
                {((c.strengths && c.strengths.length > 0) ||
                  (c.weaknesses && c.weaknesses.length > 0)) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {c.strengths?.map((s: string, i: number) => (
                      <span key={`s-${i}`} className="text-success">
                        + {s}
                      </span>
                    ))}
                    {c.weaknesses?.map((w: string, i: number) => (
                      <span key={`w-${i}`} className="text-error">
                        - {w}
                      </span>
                    ))}
                  </div>
                )}
                {c.last_researched_at && (
                  <p className="mt-1 text-xs text-mist">
                    Last researched:{" "}
                    {new Date(c.last_researched_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReadinessGauge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="text-center">
        <p className="text-lg font-heading font-semibold text-mist">—</p>
        <p className="text-xs text-mist">score</p>
      </div>
    );
  }
  const color =
    score >= 75
      ? "text-success"
      : score >= 50
        ? "text-warning"
        : "text-slate";
  return (
    <div className="text-center">
      <p className={`text-2xl font-heading font-semibold ${color}`}>
        {score}
      </p>
      <p className="text-xs text-mist">/ 100</p>
    </div>
  );
}
