"use client";

import Link from "next/link";

interface EvalCounts {
  draft: number;
  submitted: number;
  approved: number;
  published: number;
}

interface ClassData {
  id: string;
  name: string;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  levels: string[] | null;
  studentCount: number;
  evalCounts: EvalCounts;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function getStatusInfo(counts: EvalCounts, studentCount: number) {
  const total = counts.draft + counts.submitted + counts.approved + counts.published;
  const complete = counts.submitted + counts.approved + counts.published;

  if (total === 0) return { label: "Not Started", color: "bg-silver/20 text-charcoal" };
  if (counts.approved + counts.published === studentCount) return { label: "All Approved", color: "bg-success/10 text-success" };
  if (complete === studentCount) return { label: "All Submitted", color: "bg-info/10 text-info" };
  return { label: "In Progress", color: "bg-gold/10 text-gold-dark" };
}

export function EvaluationClassList({ classes }: { classes: ClassData[] }) {
  if (classes.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">Evaluations</h1>
        <p className="mt-1 text-sm text-charcoal/60">Complete evaluations for your classes</p>
        <div className="mt-12 text-center text-charcoal/50">
          <p className="text-lg">No classes assigned</p>
          <p className="mt-1 text-sm">You will see your classes here once assigned.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-heading font-semibold text-charcoal">Evaluations</h1>
      <p className="mt-1 text-sm text-charcoal/60">Complete evaluations for your classes</p>

      <div className="mt-6 grid gap-4">
        {classes.map((cls) => {
          const total = cls.evalCounts.draft + cls.evalCounts.submitted + cls.evalCounts.approved + cls.evalCounts.published;
          const complete = cls.evalCounts.submitted + cls.evalCounts.approved + cls.evalCounts.published;
          const status = getStatusInfo(cls.evalCounts, cls.studentCount);
          const pct = cls.studentCount > 0 ? Math.round((complete / cls.studentCount) * 100) : 0;
          const hasStarted = total > 0;

          return (
            <div key={cls.id} className="rounded-lg border border-silver/30 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-semibold text-charcoal truncate">{cls.name}</h3>
                  <p className="mt-0.5 text-sm text-charcoal/60">
                    {cls.dayOfWeek && <span className="capitalize">{cls.dayOfWeek}</span>}
                    {cls.startTime && cls.endTime && (
                      <span> · {formatTime(cls.startTime)}–{formatTime(cls.endTime)}</span>
                    )}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal/70">{complete} of {cls.studentCount} complete</span>
                  <span className="text-charcoal/50">{pct}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-silver/20">
                  <div
                    className="h-2 rounded-full bg-lavender transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/teach/evaluations/${cls.id}`}
                  className="inline-flex items-center text-sm font-medium text-lavender-dark hover:text-lavender"
                >
                  {hasStarted ? "Continue" : "Start Evaluations"} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
