"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherEditDrawer } from "@/components/admin/TeacherEditDrawer";

interface Teacher {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  employment_type: string | null;
  can_be_scheduled: boolean;
  specialties: string[] | null;
  hire_date: string | null;
  classCount: number;
  class_rate_cents: number | null;
  private_rate_cents: number | null;
  rehearsal_rate_cents: number | null;
  admin_rate_cents: number | null;
  is_mandated_reporter_certified: boolean;
  mandated_reporter_cert_expires_at: string | null;
  background_check_complete: boolean;
  background_check_expires_at: string | null;
  w9_on_file: boolean;
  welcomeSentAt: string | null;
}

function formatCents(cents: number | null): string {
  if (cents == null) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

export function TeacherList({ teachers }: { teachers: Teacher[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendingWelcome, setSendingWelcome] = useState<string | null>(null);
  const [welcomeStatus, setWelcomeStatus] = useState<Record<string, string>>({});
  const router = useRouter();

  function handleSaved() {
    setSelectedId(null);
    router.refresh();
  }

  async function handleSendWelcome(teacherId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSendingWelcome(teacherId);
    try {
      const res = await fetch("/api/teachers/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacherId }),
      });
      const data = await res.json();
      if (data.error) {
        setWelcomeStatus((prev) => ({ ...prev, [teacherId]: `Error: ${data.error}` }));
      } else {
        setWelcomeStatus((prev) => ({ ...prev, [teacherId]: `Sent to ${data.email}` }));
        router.refresh();
      }
    } catch {
      setWelcomeStatus((prev) => ({ ...prev, [teacherId]: "Failed to send" }));
    } finally {
      setSendingWelcome(null);
    }
  }

  return (
    <>
      {teachers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No teachers added yet.
        </div>
      ) : (
        <div className="space-y-4">
          {teachers.map((t) => {
            const name =
              [t.firstName, t.lastName].filter(Boolean).join(" ") || "Unnamed";
            const hasMandated = t.is_mandated_reporter_certified;
            const hasBackground = t.background_check_complete;
            const hasW9 = t.w9_on_file;
            const isCompliant = hasMandated && hasBackground && hasW9;

            const now = new Date();
            const mandatedExpiring = !!(
              t.mandated_reporter_cert_expires_at &&
              new Date(t.mandated_reporter_cert_expires_at) <
                new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            );
            const bgExpiring = !!(
              t.background_check_expires_at &&
              new Date(t.background_check_expires_at) <
                new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            );

            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="w-full text-left rounded-xl border border-silver bg-white p-5 hover:border-lavender hover:shadow-sm transition-all cursor-pointer"
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
                        {new Date(
                          t.hire_date + "T12:00:00"
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
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

                <div className="mt-3 pt-3 border-t border-silver flex flex-wrap gap-4 text-xs text-slate">
                  <span>
                    Class:{" "}
                    <span className="font-medium text-charcoal">
                      {formatCents(t.class_rate_cents)}/hr
                    </span>
                  </span>
                  <span>
                    Private:{" "}
                    <span className="font-medium text-charcoal">
                      {formatCents(t.private_rate_cents)}/hr
                    </span>
                  </span>
                  <span>
                    Rehearsal:{" "}
                    <span className="font-medium text-charcoal">
                      {formatCents(t.rehearsal_rate_cents)}/hr
                    </span>
                  </span>
                  <span>
                    Admin:{" "}
                    <span className="font-medium text-charcoal">
                      {formatCents(t.admin_rate_cents)}/hr
                    </span>
                  </span>
                </div>

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

                {/* Welcome email status */}
                <div className="mt-3 pt-3 border-t border-silver flex items-center gap-3">
                  {t.welcomeSentAt ? (
                    <>
                      <span className="text-xs text-success">
                        Welcome sent{" "}
                        {new Date(t.welcomeSentAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleSendWelcome(t.id, e)}
                        disabled={sendingWelcome === t.id}
                        className="text-xs text-lavender hover:text-lavender-dark font-medium disabled:opacity-50"
                      >
                        {sendingWelcome === t.id ? "Sending..." : "Resend"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleSendWelcome(t.id, e)}
                      disabled={sendingWelcome === t.id}
                      className="inline-flex items-center gap-1 rounded-full bg-lavender/10 px-3 py-1 text-xs font-medium text-lavender-dark hover:bg-lavender/20 transition-colors disabled:opacity-50"
                    >
                      {sendingWelcome === t.id ? "Sending..." : "Send Welcome Email"}
                    </button>
                  )}
                  {welcomeStatus[t.id] && (
                    <span className={`text-xs ${welcomeStatus[t.id].startsWith("Error") || welcomeStatus[t.id] === "Failed to send" ? "text-error" : "text-success"}`}>
                      {welcomeStatus[t.id]}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedId && (
        <TeacherEditDrawer
          teacherId={selectedId}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
        />
      )}
    </>
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
