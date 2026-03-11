import { requireTeacher } from "@/lib/auth/guards";
import { getMyClasses, getMyHours, getMyPayRates } from "@/lib/queries/teach";
import { LogHoursForm } from "./log-hours-form";

const categoryLabels: Record<string, string> = {
  class: "Class",
  private: "Private Lesson",
  rehearsal: "Rehearsal",
  admin: "Admin",
  sub: "Substitute",
};

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function HoursPage() {
  await requireTeacher();

  // Current month range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [classes, hours, payRates] = await Promise.all([
    getMyClasses(),
    getMyHours(startOfMonth, endOfMonth),
    getMyPayRates(),
  ]);

  // Calculate totals by category
  const totals: Record<string, number> = {};
  for (const h of hours) {
    totals[h.category] = (totals[h.category] ?? 0) + Number(h.hours);
  }
  const totalHours = Object.values(totals).reduce((a, b) => a + b, 0);

  // Estimate earnings
  const rateMap: Record<string, number | null> = {
    class: payRates?.class_rate_cents ?? null,
    private: payRates?.private_rate_cents ?? null,
    rehearsal: payRates?.rehearsal_rate_cents ?? null,
    admin: payRates?.admin_rate_cents ?? null,
    sub: payRates?.class_rate_cents ?? null,
  };

  let estimatedEarnings = 0;
  for (const [cat, hrs] of Object.entries(totals)) {
    const rate = rateMap[cat];
    if (rate != null) {
      estimatedEarnings += hrs * rate;
    }
  }

  const monthName = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Hours &amp; Pay
        </h1>
        <p className="mt-1 text-sm text-slate">
          Log teaching hours and track pay for {monthName}.
        </p>
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {totalHours.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-slate">Total Hours</p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {hours.length}
          </p>
          <p className="mt-1 text-xs text-slate">Entries</p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-gold-dark">
            {formatCents(Math.round(estimatedEarnings))}
          </p>
          <p className="mt-1 text-xs text-slate">Est. Earnings</p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4 text-center">
          <p className="text-2xl font-heading font-semibold text-charcoal">
            {hours.filter((h) => h.approved).length}/{hours.length}
          </p>
          <p className="mt-1 text-xs text-slate">Approved</p>
        </div>
      </div>

      {/* Pay Rates */}
      {payRates && (
        <div className="rounded-xl border border-silver bg-white p-4">
          <h3 className="text-xs font-semibold text-mist uppercase tracking-wide mb-2">
            Your Pay Rates
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-slate">
              Class:{" "}
              <span className="font-medium text-charcoal">
                {formatCents(payRates.class_rate_cents)}/hr
              </span>
            </span>
            <span className="text-slate">
              Private:{" "}
              <span className="font-medium text-charcoal">
                {formatCents(payRates.private_rate_cents)}/hr
              </span>
            </span>
            <span className="text-slate">
              Rehearsal:{" "}
              <span className="font-medium text-charcoal">
                {formatCents(payRates.rehearsal_rate_cents)}/hr
              </span>
            </span>
            <span className="text-slate">
              Admin:{" "}
              <span className="font-medium text-charcoal">
                {formatCents(payRates.admin_rate_cents)}/hr
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Log Hours Form */}
      <LogHoursForm
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      />

      {/* Hours History */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          {monthName} Log
        </h2>
        {hours.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
            No hours logged this month yet.
          </div>
        ) : (
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {hours.map((h) => {
              const classRaw = h.classes as unknown;
              const className = (
                Array.isArray(classRaw)
                  ? (classRaw[0] as { name: string } | undefined)?.name
                  : (classRaw as { name: string } | null)?.name
              ) ?? null;

              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark">
                        {categoryLabels[h.category] ?? h.category}
                      </span>
                      {h.approved && (
                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          Approved
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-charcoal">
                      {new Date(h.date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                      {className && (
                        <span className="text-mist"> · {className}</span>
                      )}
                    </p>
                    {h.notes && (
                      <p className="text-xs text-slate mt-0.5 truncate">
                        {h.notes}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-lg font-heading font-semibold text-charcoal">
                    {Number(h.hours).toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
