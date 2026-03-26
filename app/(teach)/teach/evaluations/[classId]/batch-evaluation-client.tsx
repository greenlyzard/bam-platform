"use client";

import { useState, useRef, useCallback } from "react";
import { SimpleSelect } from "@/components/ui/select";
import {
  upsertEvaluationResponse,
  submitEvaluation,
  submitAllForClass,
} from "@/app/(admin)/admin/evaluations/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  currentLevel: string | null;
}

interface Question {
  id: string;
  questionId: string;
  slug: string;
  label: string;
  questionType: string;
  isRequired: boolean;
  sortOrder: number;
}

interface Section {
  id: string;
  name: string;
  visibility: string;
  sortOrder: number;
  questions: Question[];
}

interface Evaluation {
  id: string;
  studentId: string;
  status: string;
}

interface ResponseData {
  evaluationId: string;
  questionId: string;
  nseValue: string | null;
  textValue: string | null;
}

interface Props {
  students: Student[];
  sections: Section[];
  evaluations: Evaluation[];
  responses: ResponseData[];
  classId: string;
  className: string;
  tenantId: string;
}

type ResponseMap = Record<string, Record<string, { nseValue?: string; textValue?: string }>>;

const LEVEL_OPTIONS = [
  { value: "Petites / Level 1", label: "Petites / Level 1" },
  { value: "Level 2", label: "Level 2" },
  { value: "Level 3 / Level 4", label: "Level 3 / Level 4" },
];

const NSE_BUTTONS = [
  { value: "N", label: "N", selectedClass: "bg-gold/10 text-gold-dark border-gold" },
  { value: "S", label: "S", selectedClass: "bg-info/10 text-info border-info" },
  { value: "E", label: "E", selectedClass: "bg-success/10 text-success border-success" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchEvaluationClient({
  students,
  sections,
  evaluations,
  responses: initialResponses,
  classId,
  className: clsName,
  tenantId,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const e of evaluations) map[e.studentId] = e.status;
    return map;
  });
  const [responses, setResponses] = useState<ResponseMap>(() => {
    const map: ResponseMap = {};
    for (const r of initialResponses) {
      if (!map[r.evaluationId]) map[r.evaluationId] = {};
      map[r.evaluationId][r.questionId] = {
        nseValue: r.nseValue ?? undefined,
        textValue: r.textValue ?? undefined,
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const student = students[currentIndex];
  const evaluation = evaluations.find((e) => e.studentId === student?.id);
  const evalId = evaluation?.id ?? "";
  const evalStatus = localStatuses[student?.id] ?? "draft";
  const evalResponses = responses[evalId] ?? {};

  // Check if a student has any responses
  const studentHasResponses = useCallback(
    (sid: string) => {
      const ev = evaluations.find((e) => e.studentId === sid);
      if (!ev) return false;
      const r = responses[ev.id];
      return r && Object.keys(r).length > 0;
    },
    [evaluations, responses]
  );

  // Count students with at least one response
  const completedCount = students.filter((s) => studentHasResponses(s.id)).length;

  // ---------------------------------------------------------------------------
  // Auto-save
  // ---------------------------------------------------------------------------

  function handleResponseChange(
    questionId: string,
    value: string,
    questionType: string
  ) {
    if (!evalId) return;

    // Update local state
    setResponses((prev) => ({
      ...prev,
      [evalId]: {
        ...prev[evalId],
        [questionId]:
          questionType === "nse_rating"
            ? { nseValue: value || undefined }
            : { textValue: value || undefined },
      },
    }));

    // Debounce server save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      const fd = new FormData();
      fd.set("evaluation_id", evalId);
      fd.set("question_id", questionId);
      fd.set("question_type", questionType);
      fd.set("value", value);
      await upsertEvaluationResponse(fd);
      setSaving(false);
    }, 1000);
  }

  function handleNseToggle(questionId: string, current: string | undefined, clicked: string) {
    const newVal = current === clicked ? "" : clicked;
    handleResponseChange(questionId, newVal, "nse_rating");
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!evalId) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("evaluation_id", evalId);
    await submitEvaluation(fd);
    setLocalStatuses((prev) => ({ ...prev, [student.id]: "submitted" }));
    setSaving(false);
  }

  async function handleSubmitAll() {
    setSaving(true);
    const fd = new FormData();
    fd.set("class_id", classId);
    await submitAllForClass(fd);
    setLocalStatuses((prev) => {
      const next = { ...prev };
      for (const s of students) {
        if (next[s.id] === "draft") next[s.id] = "submitted";
      }
      return next;
    });
    setSaving(false);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(students.length - 1, i + 1));

  if (!student) {
    return <div className="p-8 text-charcoal/60">No students found.</div>;
  }

  const initials = `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-silver/30 bg-white px-6 py-3">
        <div>
          <h1 className="font-heading font-semibold text-charcoal">{clsName}</h1>
          <p className="text-sm text-charcoal/60">
            Student {currentIndex + 1} of {students.length} · {completedCount} started
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-charcoal/40">Saving...</span>}
          <button
            onClick={handleSubmitAll}
            disabled={saving}
            className="rounded-md bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark disabled:opacity-50"
          >
            Submit All
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on mobile, dropdown substitute */}
        <div className="hidden w-56 shrink-0 overflow-y-auto border-r border-silver/30 bg-cream/50 md:block">
          {students.map((s, idx) => {
            const active = idx === currentIndex;
            const hasResp = studentHasResponses(s.id);
            const status = localStatuses[s.id] ?? "draft";
            return (
              <button
                key={s.id}
                onClick={() => setCurrentIndex(idx)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  active ? "bg-lavender/10 font-medium text-lavender-dark" : "text-charcoal/70 hover:bg-silver/10"
                }`}
              >
                {hasResp ? (
                  <span className="text-success">✓</span>
                ) : (
                  <span className="text-charcoal/20">○</span>
                )}
                <span className="truncate">
                  {s.firstName} {s.lastName?.[0]}.
                </span>
                {status === "submitted" && (
                  <span className="ml-auto text-[10px] text-info">✓✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile student selector */}
        <div className="border-b border-silver/30 bg-white px-4 py-2 md:hidden">
          <SimpleSelect
            value={student.id}
            onValueChange={(val) => {
              const idx = students.findIndex((s) => s.id === val);
              if (idx >= 0) setCurrentIndex(idx);
            }}
            options={students.map((s) => ({
              value: s.id,
              label: `${s.firstName} ${s.lastName}`,
            }))}
            placeholder="Select student"
          />
        </div>

        {/* Main evaluation area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Student header */}
          <div className="mb-6 flex items-center gap-4">
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender/20 text-sm font-semibold text-lavender-dark">
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-lg font-heading font-semibold text-charcoal">
                {student.firstName} {student.lastName}
              </h2>
              <div className="flex items-center gap-2">
                {student.currentLevel && (
                  <span className="text-sm text-charcoal/60">{student.currentLevel}</span>
                )}
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    evalStatus === "submitted"
                      ? "bg-info/10 text-info"
                      : evalStatus === "approved"
                        ? "bg-success/10 text-success"
                        : "bg-silver/20 text-charcoal/60"
                  }`}
                >
                  {evalStatus.charAt(0).toUpperCase() + evalStatus.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Sections */}
          {sections.map((section) => (
            <div key={section.id} className="mb-6 rounded-lg border border-silver/30 bg-white p-5">
              <h3 className="mb-4 font-heading font-semibold text-charcoal">
                {section.name}
                {section.visibility === "if_applicable" && (
                  <span className="ml-2 text-xs font-normal text-charcoal/40">(If applicable)</span>
                )}
              </h3>
              <div className="space-y-4">
                {section.questions.map((q) => {
                  const resp = evalResponses[q.questionId];
                  return (
                    <div key={q.id}>
                      <label className="mb-1.5 block text-sm font-medium text-charcoal/80">
                        {q.label}
                      </label>

                      {q.questionType === "nse_rating" && (
                        <div className="flex gap-2">
                          {NSE_BUTTONS.map((btn) => {
                            const selected = resp?.nseValue === btn.value;
                            return (
                              <button
                                key={btn.value}
                                type="button"
                                onClick={() =>
                                  handleNseToggle(q.questionId, resp?.nseValue, btn.value)
                                }
                                className={`h-9 w-12 rounded-md border text-sm font-semibold transition-colors ${
                                  selected ? btn.selectedClass : "border-silver text-charcoal/40 hover:border-charcoal/30"
                                }`}
                              >
                                {btn.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.questionType === "free_text" && (
                        <textarea
                          rows={3}
                          value={resp?.textValue ?? ""}
                          onChange={(e) =>
                            handleResponseChange(q.questionId, e.target.value, "free_text")
                          }
                          className="w-full rounded-md border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
                        />
                      )}

                      {q.questionType === "level_placement" && (
                        <SimpleSelect
                          value={resp?.textValue ?? ""}
                          onValueChange={(val) =>
                            handleResponseChange(q.questionId, val, "level_placement")
                          }
                          options={LEVEL_OPTIONS}
                          placeholder="Select level"
                        />
                      )}

                      {q.questionType === "text_input" && (
                        <input
                          type="text"
                          value={resp?.textValue ?? ""}
                          onChange={(e) =>
                            handleResponseChange(q.questionId, e.target.value, "text_input")
                          }
                          className="w-full rounded-md border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-silver/30 bg-white px-6 py-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="rounded-md border border-silver px-4 py-2 text-sm font-medium text-charcoal hover:bg-silver/10 disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || evalStatus === "submitted"}
          className="rounded-md bg-lavender-dark px-4 py-2 text-sm font-medium text-white hover:bg-lavender disabled:opacity-50"
        >
          {evalStatus === "submitted" ? "Submitted" : "Submit"}
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === students.length - 1}
          className="rounded-md border border-silver px-4 py-2 text-sm font-medium text-charcoal hover:bg-silver/10 disabled:opacity-30"
        >
          Save & Next →
        </button>
      </div>
    </div>
  );
}
