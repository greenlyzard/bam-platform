"use client";

import { useState, useEffect, useMemo } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { createPrivateSession } from "@/app/(admin)/admin/privates/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "duet", label: "Duet" },
  { value: "group", label: "Group" },
  { value: "pilates", label: "Pilates" },
  { value: "hybrid", label: "Hybrid" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min" },
  { value: "custom", label: "Custom" },
];

const STUDIO_OPTIONS = [
  { value: "Studio 1", label: "Studio 1" },
  { value: "Studio 2", label: "Studio 2" },
  { value: "Studio 3", label: "Studio 3" },
  { value: "Other", label: "Other" },
];

const RECURRENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
];

const BILLING_MODEL_OPTIONS = [
  { value: "split_equal", label: "Split Equal" },
  { value: "split_custom", label: "Split Custom" },
  { value: "full_per_student", label: "Full Per Student" },
  { value: "comp", label: "Comp" },
  { value: "bundle", label: "Bundle" },
];

const inputCls =
  "w-full rounded-md border border-silver bg-white px-3 py-2 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMinutes(time: string, mins: number): string {
  const [hh, mm] = time.split(":").map(Number);
  const total = hh * 60 + mm + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrivateSessionForm({
  tenantId,
  defaultTeacherId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  defaultTeacherId?: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  // Form state
  const [sessionType, setSessionType] = useState("solo");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("15:00");
  const [duration, setDuration] = useState("60");
  const [endTime, setEndTime] = useState("16:00");
  const [studio, setStudio] = useState("Studio 1");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [coTeacherId, setCoTeacherId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("weekly");
  const [sessionRate, setSessionRate] = useState("");
  const [marketRate, setMarketRate] = useState("");
  const [billingModel, setBillingModel] = useState("split_equal");
  const [sessionNotes, setSessionNotes] = useState("");
  const [parentVisibleNotes, setParentVisibleNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [teacherId, setTeacherId] = useState(defaultTeacherId ?? "");

  // Auto-calc endTime when startTime or duration changes
  useEffect(() => {
    if (duration !== "custom" && startTime) {
      setEndTime(addMinutes(startTime, parseInt(duration, 10)));
    }
  }, [startTime, duration]);

  // Load students + teachers on mount
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: studentRows } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name");
      if (studentRows) setStudents(studentRows);

      const { data: teacherRows } = await supabase
        .from("teacher_profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name");
      if (teacherRows) setTeachers(teacherRows);

      // Auto-populate rate from teacher_rate_cards if teacher known
      if (defaultTeacherId) {
        const { data: rateCard } = await supabase
          .from("teacher_rate_cards")
          .select("private_rate")
          .eq("teacher_id", defaultTeacherId)
          .limit(1)
          .single();
        if (rateCard?.private_rate) setSessionRate(String(rateCard.private_rate));
      }
    })();
  }, [defaultTeacherId]);

  // Filtered students for search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const toggleStudent = (id: string) => {
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const studentName = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.first_name} ${s.last_name}` : id;
  };

  // Submit
  const handleSubmit = async () => {
    setError("");
    if (!date || !startTime || !endTime) {
      setError("Date and times are required.");
      return;
    }
    if (!teacherId) {
      setError("Please select a teacher.");
      return;
    }
    if (studentIds.length === 0) {
      setError("At least one student is required.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("tenant_id", tenantId);
      fd.set("session_type", sessionType);
      fd.set("session_date", date);
      fd.set("start_time", startTime);
      fd.set("end_time", endTime);
      fd.set("duration_minutes", duration === "custom" ? "" : duration);
      fd.set("studio", studio);
      fd.set("primary_teacher_id", teacherId);
      fd.set("student_ids", JSON.stringify(studentIds));
      fd.set("co_teacher_ids", coTeacherId ? JSON.stringify([coTeacherId]) : "[]");
      fd.set("is_recurring", String(isRecurring));
      if (isRecurring) fd.set("recurrence_rule", recurrenceRule);
      if (sessionRate) fd.set("session_rate", sessionRate);
      if (marketRate) fd.set("market_rate", marketRate);
      fd.set("billing_model", billingModel);
      fd.set("session_notes", sessionNotes);
      fd.set("parent_visible_notes", parentVisibleNotes);
      fd.set("booking_source", defaultTeacherId ? "teacher" : "admin");

      const result = await createPrivateSession(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onCreated?.();
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const teacherOptions = teachers
    .filter((t) => t.id !== teacherId)
    .map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }));

  const primaryTeacherOptions = teachers.map((t) => ({
    value: t.id,
    label: `${t.first_name} ${t.last_name}`,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Card */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl mx-4 p-6">
        <h2
          className="text-xl font-semibold text-charcoal mb-4"
          style={{ fontFamily: "var(--font-heading, 'Cormorant Garamond', serif)" }}
        >
          Schedule Private Session
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Row 1 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Session Type</label>
            <SimpleSelect value={sessionType} onValueChange={setSessionType} options={SESSION_TYPES} placeholder="Type" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
            <SimpleSelect value={duration} onValueChange={setDuration} options={DURATION_OPTIONS} placeholder="Duration" />
          </div>

          {/* Row 3 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={duration !== "custom"}
              className={`${inputCls} ${duration !== "custom" ? "opacity-60" : ""}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Studio</label>
            <SimpleSelect value={studio} onValueChange={setStudio} options={STUDIO_OPTIONS} placeholder="Studio" />
          </div>

          {/* Teacher */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Primary Teacher</label>
            <SimpleSelect value={teacherId} onValueChange={setTeacherId} options={primaryTeacherOptions} placeholder="Select teacher" />
          </div>

          {/* Student search — full width */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Students</label>
            {studentIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {studentIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-lavender/15 text-dark-lavender text-xs font-medium px-2.5 py-1"
                  >
                    {studentName(id)}
                    <button type="button" onClick={() => toggleStudent(id)} className="hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={inputCls}
            />
            {searchQuery && filteredStudents.length > 0 && (
              <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-silver bg-white shadow-sm">
                {filteredStudents.slice(0, 20).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { toggleStudent(s.id); setSearchQuery(""); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-lavender/10 ${
                      studentIds.includes(s.id) ? "bg-lavender/10 font-medium" : ""
                    }`}
                  >
                    {s.first_name} {s.last_name}
                    {studentIds.includes(s.id) && " \u2713"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Co-teacher */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Co-Teacher (optional)</label>
            <SimpleSelect
              value={coTeacherId}
              onValueChange={setCoTeacherId}
              options={[{ value: "", label: "None" }, ...teacherOptions]}
              placeholder="None"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-silver text-lavender focus:ring-lavender"
              />
              Recurring
            </label>
          </div>
          {isRecurring ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recurrence</label>
              <SimpleSelect value={recurrenceRule} onValueChange={setRecurrenceRule} options={RECURRENCE_OPTIONS} placeholder="Frequency" />
            </div>
          ) : (
            <div />
          )}

          {/* Rates */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Session Rate ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sessionRate}
              onChange={(e) => setSessionRate(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Market Rate ($) <span className="text-gray-400">optional</span></label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={marketRate}
              onChange={(e) => setMarketRate(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>

          {/* Billing model */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Billing Model</label>
            <SimpleSelect value={billingModel} onValueChange={setBillingModel} options={BILLING_MODEL_OPTIONS} placeholder="Billing model" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className={inputCls}
              placeholder="Staff-only notes..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Parent Visible Notes</label>
            <textarea
              rows={2}
              value={parentVisibleNotes}
              onChange={(e) => setParentVisibleNotes(e.target.value)}
              className={inputCls}
              placeholder="Visible to parents..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-silver/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-lavender px-5 py-2 text-sm font-medium text-white hover:bg-dark-lavender disabled:opacity-50 transition-colors"
          >
            {loading ? "Scheduling..." : "Schedule Private"}
          </button>
        </div>
      </div>
    </div>
  );
}
