"use client";

import { useState, useEffect, useTransition } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { enrollStudentInClass, checkBillingPlan } from "./actions";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  family_id?: string | null;
  tenant_id: string;
}

interface ClassOption {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  levels: string[] | null;
  max_enrollment: number | null;
  max_students: number;
  enrolledCount: number;
  trial_eligible: boolean;
  point_cost: number;
  isEnrolled: boolean;
}

interface BillingResult {
  planType: "unlimited" | "bundle" | "per_class";
  message: string;
  balance?: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function AddToClassModal({
  student,
  tenantId,
  onClose,
  onEnrolled,
}: {
  student: Student;
  tenantId: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [billingResult, setBillingResult] = useState<BillingResult | null>(null);
  const [enrollmentType, setEnrollmentType] = useState("full");
  const [suppressOnboarding, setSuppressOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("classes")
      .select("id, name, day_of_week, start_time, end_time, levels, max_enrollment, max_students, trial_eligible, point_cost, is_active")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        supabase
          .from("enrollments")
          .select("class_id, student_id, status")
          .in("status", ["active", "trial"])
          .then(({ data: enrollments }) => {
            const countMap: Record<string, number> = {};
            const studentEnrolled = new Set<string>();
            for (const e of enrollments ?? []) {
              countMap[e.class_id] = (countMap[e.class_id] ?? 0) + 1;
              if (e.student_id === student.id) studentEnrolled.add(e.class_id);
            }
            setClasses(
              (data ?? []).map((c) => ({
                ...c,
                enrolledCount: countMap[c.id] ?? 0,
                isEnrolled: studentEnrolled.has(c.id),
                trial_eligible: c.trial_eligible ?? true,
                point_cost: c.point_cost ?? 1,
              }))
            );
          });
      });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profile_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .then(({ data }) => setUserRoles((data ?? []).map((r) => r.role)));
      }
    });
  }, [student.id]);

  useEffect(() => {
    if (step === 2 && selectedClass && !billingResult) {
      setLoading(true);
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      fd.set("studentId", student.id);
      fd.set("pointCost", String(selectedClass.point_cost));
      checkBillingPlan(fd)
        .then((result) => {
          if ("error" in result && result.error) {
            setError(result.error);
          } else {
            setBillingResult(result as BillingResult);
          }
        })
        .catch(() => setError("Failed to check billing plan"))
        .finally(() => setLoading(false));
    }
  }, [step, selectedClass, billingResult, student.family_id, tenantId]);

  const handleConfirm = () => {
    if (!selectedClass) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("studentId", student.id);
    fd.append("classId", selectedClass.id);
    fd.append("tenantId", tenantId);
    fd.append("enrollmentType", enrollmentType);
    fd.append("suppressOnboarding", suppressOnboarding ? "true" : "false");
    if (student.family_id) fd.append("familyId", student.family_id);

    startTransition(async () => {
      try {
        await enrollStudentInClass(fd);
        onEnrolled();
      } catch (e: any) {
        setError(e?.message ?? "Enrollment failed");
      } finally {
        setLoading(false);
      }
    });
  };

  const filtered = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = userRoles.includes("finance_admin") || userRoles.includes("super_admin");

  const enrollTypeOptions = [
    { value: "full", label: "Full Enrollment" },
    ...(selectedClass?.trial_eligible ? [{ value: "trial", label: "Trial" }] : []),
    ...(isAdmin ? [{ value: "comp", label: "Comp" }, { value: "staff", label: "Staff" }] : []),
  ];

  const stepTitles = ["Select Class", "Billing Check", "Enrollment Type", "Confirm"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-silver px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate font-medium">Step {step} of 4</p>
            <h2 className="text-lg font-semibold text-charcoal">{stepTitles[step - 1]}</h2>
          </div>
          <button onClick={onClose} className="text-slate hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2">
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <input
                type="text"
                placeholder="Search classes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none mb-3"
              />
              <div className="max-h-80 overflow-y-auto space-y-1">
                {filtered.map((c) => {
                  const isFull = c.enrolledCount >= c.max_students;
                  const disabled = c.isEnrolled || isFull;
                  return (
                    <button
                      key={c.id}
                      disabled={disabled}
                      onClick={() => { setSelectedClass(c); setStep(2); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${
                        disabled
                          ? "opacity-50 cursor-not-allowed border-silver bg-gray-50"
                          : "border-silver hover:border-lavender hover:bg-lavender/5 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-charcoal">{c.name}</span>
                        <div className="flex items-center gap-1.5">
                          {c.isEnrolled && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-lavender/20 text-lavender">Enrolled</span>
                          )}
                          {isFull && !c.isEnrolled && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600">Full</span>
                          )}
                          {c.trial_eligible && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Trial OK</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {c.day_of_week != null && (
                          <span className="text-xs text-slate">
                            {DAY_NAMES[c.day_of_week]} {formatTime(c.start_time)}–{formatTime(c.end_time)}
                          </span>
                        )}
                        <span className="text-xs text-slate">{c.enrolledCount}/{c.max_students}</span>
                      </div>
                      {c.levels && c.levels.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {c.levels.map((l) => (
                            <span key={l} className="rounded-full px-2 py-0.5 text-xs font-medium bg-silver/40 text-slate">{l}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-sm text-slate text-center py-6">No classes found</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && selectedClass && (
            <div className="space-y-4">
              <div className="rounded-lg border border-silver p-4">
                <p className="font-medium text-charcoal">{selectedClass.name}</p>
                {selectedClass.day_of_week != null && (
                  <p className="text-sm text-slate mt-1">
                    {DAY_NAMES[selectedClass.day_of_week]} {formatTime(selectedClass.start_time)}–{formatTime(selectedClass.end_time)}
                  </p>
                )}
              </div>
              {loading ? (
                <p className="text-sm text-slate">Checking billing plan...</p>
              ) : billingResult ? (
                <div className="rounded-lg border border-silver p-4">
                  <div className="flex items-center gap-2">
                    {billingResult.planType === "unlimited" && (
                      <span className="text-green-600 text-lg">&#10003;</span>
                    )}
                    {billingResult.planType === "bundle" && <span className="text-lg">&#127915;</span>}
                    {billingResult.planType === "per_class" && <span className="text-lg">&#128179;</span>}
                    <span className={
                      billingResult.planType === "unlimited"
                        ? "text-green-600 text-sm font-medium"
                        : billingResult.planType === "bundle"
                        ? "text-charcoal text-sm font-medium"
                        : "text-slate text-sm font-medium"
                    }>
                      {billingResult.message}
                    </span>
                  </div>
                  {billingResult.balance != null && (
                    <p className="text-xs text-slate mt-1">Balance: {billingResult.balance}</p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Enrollment Type</label>
                <SimpleSelect
                  value={enrollmentType}
                  onValueChange={setEnrollmentType}
                  options={enrollTypeOptions}
                />
              </div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-charcoal">Suppress onboarding emails</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={suppressOnboarding}
                  onClick={() => setSuppressOnboarding(!suppressOnboarding)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    suppressOnboarding ? "bg-lavender" : "bg-silver"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    suppressOnboarding ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </label>
            </div>
          )}

          {step === 4 && selectedClass && (
            <div className="rounded-lg border border-silver p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate">Student</span>
                <span className="text-charcoal font-medium">{student.first_name} {student.last_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate">Class</span>
                <div className="text-right">
                  <p className="text-charcoal font-medium">{selectedClass.name}</p>
                  {selectedClass.day_of_week != null && (
                    <p className="text-xs text-slate">
                      {DAY_NAMES[selectedClass.day_of_week]} {formatTime(selectedClass.start_time)}–{formatTime(selectedClass.end_time)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate">Type</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-lavender/20 text-lavender capitalize">{enrollmentType}</span>
              </div>
              {billingResult && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate">Billing</span>
                  <span className="text-charcoal text-right">{billingResult.message}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate">Onboarding</span>
                <span className="text-charcoal">{suppressOnboarding ? "Suppressed" : "Enabled"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step > 1 && (
          <div className="border-t border-silver px-5 py-3 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              className="h-10 rounded-lg border border-silver text-slate hover:text-charcoal text-sm px-5"
            >
              Back
            </button>
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={loading || !billingResult}
                className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5 disabled:opacity-50"
              >
                Continue
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5"
              >
                Continue
              </button>
            )}
            {step === 4 && (
              <button
                onClick={handleConfirm}
                disabled={loading || isPending}
                className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5 disabled:opacity-50"
              >
                {loading || isPending ? "Enrolling..." : "Confirm Enrollment"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
