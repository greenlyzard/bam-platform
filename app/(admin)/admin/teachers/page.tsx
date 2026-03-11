import { requireAdmin } from "@/lib/auth/guards";
import { getAllTeachers } from "@/lib/queries/admin";

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function TeachersPage() {
  await requireAdmin();
  const teachers = await getAllTeachers();

  const complianceIssues = teachers.filter(
    (t) =>
      !t.is_mandated_reporter_certified ||
      !t.background_check_complete ||
      !t.w9_on_file
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Teachers
          </h1>
          <p className="mt-1 text-sm text-slate">
            {teachers.length} teachers ·{" "}
            {complianceIssues.length > 0 ? (
              <span className="text-error">
                {complianceIssues.length} compliance issue
                {complianceIssues.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-success">All compliant</span>
            )}
          </p>
        </div>
      </div>

      {/* Teacher cards */}
      {teachers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No teachers added yet.
        </div>
      ) : (
        <div className="space-y-4">
          {teachers.map((t) => {
            const name = [t.firstName, t.lastName].filter(Boolean).join(" ") || "Unnamed";
            const hasMandated = t.is_mandated_reporter_certified;
            const hasBackground = t.background_check_complete;
            const hasW9 = t.w9_on_file;
            const isCompliant = hasMandated && hasBackground && hasW9;

            // Check for expiring certs
            const now = new Date();
            const mandatedExpiring =
              t.mandated_reporter_cert_expires_at &&
              new Date(t.mandated_reporter_cert_expires_at) <
                new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const bgExpiring =
              t.background_check_expires_at &&
              new Date(t.background_check_expires_at) <
                new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            return (
              <div
                key={t.id}
                className="rounded-xl border border-silver bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-charcoal">{name}</h3>
                      {t.employment_type && (
                        <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                          {t.employment_type.replace("_", " ")}
                        </span>
                      )}
                      {!t.can_be_scheduled && (
                        <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                          Not schedulable
                        </span>
                      )}
                    </div>
                    {t.email && (
                      <p className="text-sm text-slate">{t.email}</p>
                    )}
                    {t.specialties && t.specialties.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.specialties.map((s: string) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender-dark"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.hire_date && (
                      <p className="text-xs text-mist mt-1">
                        Hired{" "}
                        {new Date(t.hire_date + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", year: "numeric" }
                        )}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-heading font-semibold text-charcoal">
                      {t.classCount}
                    </p>
                    <p className="text-xs text-mist">
                      class{t.classCount !== 1 ? "es" : ""}
                    </p>
                  </div>
                </div>

                {/* Pay rates */}
                <div className="mt-3 pt-3 border-t border-silver flex flex-wrap gap-4 text-xs text-slate">
                  <span>
                    Class: <span className="font-medium text-charcoal">{formatCents(t.class_rate_cents)}/hr</span>
                  </span>
                  <span>
                    Private: <span className="font-medium text-charcoal">{formatCents(t.private_rate_cents)}/hr</span>
                  </span>
                  <span>
                    Rehearsal: <span className="font-medium text-charcoal">{formatCents(t.rehearsal_rate_cents)}/hr</span>
                  </span>
                  <span>
                    Admin: <span className="font-medium text-charcoal">{formatCents(t.admin_rate_cents)}/hr</span>
                  </span>
                </div>

                {/* Compliance */}
                <div className="mt-3 pt-3 border-t border-silver flex flex-wrap gap-3">
                  <ComplianceBadge
                    label="Mandated Reporter"
                    ok={hasMandated}
                    warning={mandatedExpiring}
                  />
                  <ComplianceBadge
                    label="Background Check"
                    ok={hasBackground}
                    warning={bgExpiring}
                  />
                  <ComplianceBadge label="W-9" ok={hasW9} />
                  {isCompliant && (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      Fully Compliant
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComplianceBadge({
  label,
  ok,
  warning,
}: {
  label: string;
  ok: boolean;
  warning?: boolean | null;
}) {
  if (ok && !warning) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <span>✓</span> {label}
      </span>
    );
  }
  if (ok && warning) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning font-medium">
        <span>!</span> {label} expiring
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-error font-medium">
      <span>✗</span> {label}
    </span>
  );
}
