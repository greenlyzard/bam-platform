import { requireAdmin } from "@/lib/auth/guards";
import {
  getEnrollmentStats,
  getCapacitySummary,
  getExpansionMarkets,
} from "@/lib/queries/admin";
import { getPayrollSummary } from "@/lib/queries/payroll-summary";

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const [stats, capacity, markets, payroll] = await Promise.all([
    getEnrollmentStats(),
    getCapacitySummary(),
    getExpansionMarkets(),
    getPayrollSummary(),
  ]);

  // Top expansion market
  const topMarket = markets[0];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Studio Overview
        </h1>
        <p className="mt-1 text-sm text-slate">
          Ballet Academy and Movement — San Clemente, CA
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Active Students"
          value={stats.totalStudents}
          color="text-charcoal"
        />
        <KpiCard
          label="Enrollments"
          value={stats.totalEnrollments}
          color="text-charcoal"
        />
        <KpiCard
          label="On Waitlist"
          value={stats.waitlistCount}
          color="text-info"
        />
        <KpiCard
          label="Trial Students"
          value={stats.trialCount}
          color="text-warning"
        />
        <KpiCard
          label="Capacity"
          value={`${capacity.capacityPercent}%`}
          color={
            capacity.capacityPercent >= 90
              ? "text-error"
              : capacity.capacityPercent >= 70
                ? "text-warning"
                : "text-success"
          }
        />
        <KpiCard
          label="Classes Full"
          value={`${capacity.classesAtCapacity}/${capacity.totalClasses}`}
          color="text-charcoal"
        />
      </div>

      {/* Capacity Breakdown */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Enrollment Capacity
          </h2>
          <a
            href="/admin/classes"
            className="text-sm text-lavender hover:text-lavender-dark font-medium"
          >
            Manage Classes
          </a>
        </div>
        <div className="rounded-xl border border-silver bg-white p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <div className="h-3 rounded-full bg-cloud overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    capacity.capacityPercent >= 90
                      ? "bg-error"
                      : capacity.capacityPercent >= 70
                        ? "bg-warning"
                        : "bg-success"
                  }`}
                  style={{ width: `${Math.min(capacity.capacityPercent, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-charcoal">
              {capacity.totalEnrolled}/{capacity.totalCapacity}
            </span>
          </div>
          <p className="text-xs text-slate">
            {capacity.totalClasses} active classes ·{" "}
            {capacity.classesAtCapacity} at capacity ·{" "}
            {capacity.totalCapacity - capacity.totalEnrolled} open spots
          </p>
        </div>
      </section>

      {/* Payroll Summary */}
      {payroll.pendingCount > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Payroll Summary
            </h2>
            <a
              href="/admin/timesheets/payroll"
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              Payroll Report →
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-warning">
                {payroll.pendingCount}
              </p>
              <p className="mt-1 text-xs text-slate">Pending Approval</p>
            </div>
            <div className="rounded-xl border border-silver bg-white p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-charcoal">
                {payroll.totalHoursThisMonth.toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-slate">Hours This Month</p>
            </div>
            <div className="rounded-xl border border-silver bg-white p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-charcoal">
                ${payroll.estimatedPayroll.toFixed(0)}
              </p>
              <p className="mt-1 text-xs text-slate">Est. Payroll</p>
            </div>
            <div className="rounded-xl border border-silver bg-white p-4 text-center">
              <p className="text-2xl font-heading font-semibold text-charcoal">
                {payroll.flaggedCount}
              </p>
              <p className="mt-1 text-xs text-slate">Flagged</p>
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/admin/classes" icon="▦" label="Classes" />
          <QuickAction href="/admin/teachers" icon="★" label="Teachers" />
          <QuickAction href="/admin/students" icon="♡" label="Students" />
          <QuickAction href="/admin/expansion" icon="●" label="Expansion" />
          <QuickAction href="/admin/performances" icon="♛" label="Performances" />
          <QuickAction href="/admin/communications" icon="✉" label="Announce" />
          <QuickAction href="/admin/billing" icon="✦" label="Billing" />
          <QuickAction href="/admin/compliance" icon="◆" label="Compliance" />
        </div>
      </section>

      {/* Expansion Readiness */}
      {topMarket && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Expansion Readiness
            </h2>
            <a
              href="/admin/expansion"
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              Full Report
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markets.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-silver bg-white p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-charcoal">{m.city}</h4>
                  <ReadinessScore score={m.readiness_score} />
                </div>
                <div className="text-xs text-slate space-y-0.5">
                  {m.population && (
                    <p>Pop: {m.population.toLocaleString()}</p>
                  )}
                  {m.median_household_income && (
                    <p>
                      Median income: $
                      {m.median_household_income.toLocaleString()}
                    </p>
                  )}
                  {m.competitor_count != null && (
                    <p>{m.competitor_count} competitors</p>
                  )}
                  {m.drive_time_minutes && (
                    <p>{m.drive_time_minutes} min drive</p>
                  )}
                </div>
                <span
                  className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.status === "ready"
                      ? "bg-success/10 text-success"
                      : m.status === "evaluating"
                        ? "bg-warning/10 text-warning"
                        : "bg-cloud text-slate"
                  }`}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Studio Contact */}
      <section className="rounded-xl border border-silver bg-white p-5">
        <h3 className="font-heading text-base font-semibold text-charcoal">
          Studio Details
        </h3>
        <p className="mt-1 text-sm text-slate">
          400-C Camino De Estrella, San Clemente, CA 92672 ·{" "}
          <a
            href="tel:+19492290846"
            className="text-lavender hover:text-lavender-dark font-medium"
          >
            (949) 229-0846
          </a>{" "}
          ·{" "}
          <a
            href="mailto:dance@bamsocal.com"
            className="text-lavender hover:text-lavender-dark font-medium"
          >
            dance@bamsocal.com
          </a>
        </p>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 text-center">
      <p className={`text-2xl font-heading font-semibold ${color}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-silver bg-white p-4 text-center hover:border-lavender hover:shadow-sm transition-all"
    >
      <span className="text-xl text-lavender">{icon}</span>
      <span className="text-xs font-medium text-charcoal">{label}</span>
    </a>
  );
}

function ReadinessScore({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 75
      ? "text-success bg-success/10"
      : score >= 50
        ? "text-warning bg-warning/10"
        : "text-slate bg-cloud";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
      {score}
    </span>
  );
}
