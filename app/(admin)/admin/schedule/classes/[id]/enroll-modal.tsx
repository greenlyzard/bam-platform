"use client";

import { useState, useEffect } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { adminEnrollStudent } from "@/app/(admin)/admin/families/actions";

interface FamilyResult {
  id: string;
  family_name: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    family_id: string;
    date_of_birth: string;
    trial_used: boolean;
  }[];
}

interface EnrollModalProps {
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalStep = "search" | "settings" | "confirm";

export function EnrollModal({ classId, onClose, onSuccess }: EnrollModalProps) {
  const [step, setStep] = useState<ModalStep>("search");
  const [query, setQuery] = useState("");
  const [families, setFamilies] = useState<FamilyResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    familyId: string;
    familyName: string;
    trialUsed: boolean;
  } | null>(null);

  // Enrollment settings
  const [enrollmentType, setEnrollmentType] = useState<"full" | "trial" | "audit" | "comp">("full");
  const [prorationMethod, setProrationMethod] = useState("per_class");
  const [billingOverride, setBillingOverride] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setFamilies([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/families?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setFamilies(data);
        }
      } catch {
        // ignore
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function selectStudent(
    student: FamilyResult["students"][0],
    family: FamilyResult
  ) {
    setSelectedStudent({
      id: student.id,
      name: `${student.first_name} ${student.last_name}`,
      familyId: family.id,
      familyName: family.family_name,
      trialUsed: student.trial_used,
    });
    setStep("settings");
  }

  async function handleEnroll() {
    if (!selectedStudent) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.set("student_id", selectedStudent.id);
    fd.set("class_id", classId);
    fd.set("family_id", selectedStudent.familyId);
    fd.set("enrollment_type", enrollmentType);
    fd.set("proration_method", prorationMethod);
    if (billingOverride) {
      fd.set("billing_override", "true");
      fd.set("override_amount", overrideAmount);
      fd.set("override_reason", overrideReason);
    }

    const result = await adminEnrollStudent(fd);
    setSubmitting(false);

    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-silver">
          <h3 className="font-heading text-lg font-semibold text-charcoal">
            Enroll Student
          </h3>
          <button
            onClick={onClose}
            className="text-mist hover:text-charcoal text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 text-sm text-[#C45B5B]">
              {error}
            </div>
          )}

          {/* Step 1: Search */}
          {step === "search" && (
            <>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search families by name..."
                autoFocus
                className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />

              {searching && (
                <p className="text-sm text-mist">Searching...</p>
              )}

              {families.length > 0 && (
                <div className="space-y-2">
                  {families.map((family) => (
                    <div
                      key={family.id}
                      className="rounded-lg border border-silver p-3"
                    >
                      <p className="font-medium text-charcoal text-sm mb-2">
                        {family.family_name}
                      </p>
                      {family.students.length === 0 ? (
                        <p className="text-xs text-mist">
                          No students in this family.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {family.students.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => selectStudent(s, family)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-cloud transition-colors text-sm"
                            >
                              <span className="text-charcoal">
                                {s.first_name} {s.last_name}
                              </span>
                              <span className="text-mist text-xs ml-2">
                                DOB: {s.date_of_birth}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {query.length >= 2 && families.length === 0 && !searching && (
                <p className="text-sm text-mist">
                  No families found. Try a different search term.
                </p>
              )}
            </>
          )}

          {/* Step 2: Settings */}
          {step === "settings" && selectedStudent && (
            <>
              <div className="rounded-lg bg-cloud/50 border border-silver/50 p-3">
                <p className="text-sm font-medium text-charcoal">
                  {selectedStudent.name}
                </p>
                <p className="text-xs text-mist">
                  {selectedStudent.familyName}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">
                    Enrollment Type
                  </label>
                  <SimpleSelect
                    value={enrollmentType}
                    onValueChange={(val) =>
                      setEnrollmentType(
                        val as "full" | "trial" | "audit" | "comp"
                      )
                    }
                    options={[
                      { value: "full", label: "Full Enrollment" },
                      { value: "trial", label: "Trial" },
                      { value: "audit", label: "Audit (Observe Only)" },
                      { value: "comp", label: "Comp (Complimentary)" },
                    ]}
                    placeholder="Select type..."
                    className="w-full"
                  />
                  {enrollmentType === "trial" && selectedStudent.trialUsed && (
                    <p className="mt-1 text-xs text-[#D4A843]">
                      This student has already used their free trial. A second
                      trial requires Super Admin approval.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate mb-1">
                    Proration Method
                  </label>
                  <SimpleSelect
                    value={prorationMethod}
                    onValueChange={(val) => setProrationMethod(val)}
                    options={[
                      { value: "per_class", label: "Per-Class Rate" },
                      { value: "daily", label: "Daily Rate" },
                      { value: "split", label: "Split (before/after 15th)" },
                      { value: "none", label: "No Proration" },
                    ]}
                    placeholder="Select method..."
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-slate">
                    <input
                      type="checkbox"
                      checked={billingOverride}
                      onChange={(e) => setBillingOverride(e.target.checked)}
                      className="rounded border-silver"
                    />
                    Billing Override
                  </label>
                </div>

                {billingOverride && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate mb-1">
                        Custom Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate mb-1">
                        Reason
                      </label>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Scholarship, comp, etc."
                        className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep("search");
                    setSelectedStudent(null);
                  }}
                  className="h-10 rounded-lg border border-silver text-sm font-medium px-4 text-slate hover:bg-cloud transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors"
                >
                  Review
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && selectedStudent && (
            <>
              <h4 className="font-medium text-charcoal text-sm">
                Confirm Enrollment
              </h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-mist text-xs">Student</dt>
                  <dd className="text-charcoal">{selectedStudent.name}</dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Family</dt>
                  <dd className="text-charcoal">
                    {selectedStudent.familyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Type</dt>
                  <dd className="text-charcoal capitalize">{enrollmentType}</dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Proration</dt>
                  <dd className="text-charcoal capitalize">
                    {prorationMethod.replace("_", " ")}
                  </dd>
                </div>
                {billingOverride && (
                  <>
                    <div>
                      <dt className="text-mist text-xs">Override Amount</dt>
                      <dd className="text-charcoal">
                        ${overrideAmount || "0.00"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-mist text-xs">Reason</dt>
                      <dd className="text-charcoal">{overrideReason || "-"}</dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("settings")}
                  className="h-10 rounded-lg border border-silver text-sm font-medium px-4 text-slate hover:bg-cloud transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleEnroll}
                  disabled={submitting}
                  className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Enrolling..." : "Confirm Enrollment"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
