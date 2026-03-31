"use client";

import { useState, useEffect, useMemo } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { createPrivateSession, checkStudentCredits } from "@/app/(admin)/admin/privates/actions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  family_id?: string | null;
  is_adult?: boolean;
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

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${(m || 0).toString().padStart(2, "0")} ${ap}`;
}

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
  const [coTeacherId, setCoTeacherId] = useState("__none__");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("weekly");
  const [sessionRate, setSessionRate] = useState("");
  const [marketRate, setMarketRate] = useState("");
  const [billingModel, setBillingModel] = useState("split_equal");
  const [sessionNotes, setSessionNotes] = useState("");
  const [parentVisibleNotes, setParentVisibleNotes] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("parent_only");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [closureWarning, setClosureWarning] = useState<string | null>(null);
  const [studioBookings, setStudioBookings] = useState<any[]>([]);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [teacherId, setTeacherId] = useState(defaultTeacherId ?? "__none__");
  const [creditInfo, setCreditInfo] = useState<{ studentId: string; balance: number; pointCost: number; sufficient: boolean }[]>([]);

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
        .select("id, first_name, last_name, family_id, is_adult")
        .eq("active", true)
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

  // Fetch credit balances when students or teacher change
  useEffect(() => {
    if (studentIds.length === 0 || !teacherId || teacherId === "__none__") {
      setCreditInfo([]);
      return;
    }
    const fd = new FormData();
    fd.set("studentIds", JSON.stringify(studentIds));
    fd.set("tenantId", tenantId);
    fd.set("teacherId", teacherId);
    fd.set("sessionType", sessionType);
    checkStudentCredits(fd).then((result) => {
      if ("credits" in result && Array.isArray(result.credits)) setCreditInfo(result.credits as typeof creditInfo);
    });
  }, [studentIds, teacherId, sessionType, tenantId]);

  // Fetch studio availability when date or studio changes
  useEffect(() => {
    if (!date || !studio || studio === "Other") {
      setStudioBookings([]);
      return;
    }
    fetch(`/api/admin/studio-availability?date=${date}&studio=${encodeURIComponent(studio)}`)
      .then((r) => r.json())
      .then((data) => setStudioBookings([...(data.classes ?? []), ...(data.privates ?? [])]))
      .catch(() => setStudioBookings([]));
  }, [date, studio]);

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
    if (!s) return id;
    const label = `${s.first_name} ${s.last_name}`;
    return s.is_adult || !s.family_id ? `${label} (Adult)` : label;
  };

  async function proceedWithBooking(fd: FormData) {
    setClosureWarning(null);
    setPendingFormData(null);
    setLoading(true);
    try {
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
  }

  // Submit
  const handleSubmit = async () => {
    setError("");
    if (!date || !startTime || !endTime) {
      setError("Date and times are required.");
      return;
    }
    if (!teacherId || teacherId === "__none__") {
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
      fd.set("co_teacher_ids", coTeacherId && coTeacherId !== "__none__" ? JSON.stringify([coTeacherId]) : "[]");
      fd.set("is_recurring", String(isRecurring));
      if (isRecurring) fd.set("recurrence_rule", recurrenceRule);
      if (sessionRate) fd.set("session_rate", sessionRate);
      if (marketRate) fd.set("market_rate", marketRate);
      fd.set("billing_model", billingModel);
      fd.set("session_notes", sessionNotes);
      fd.set("parent_visible_notes", parentVisibleNotes);
      fd.set("student_can_see_notes", noteVisibility === "student_and_parent" || noteVisibility === "student_only" ? "true" : "false");
      fd.set("booking_source", defaultTeacherId ? "teacher" : "admin");

      // Check if selected date is a studio closure
      try {
        const closureRes = await fetch(`/api/admin/studio-settings/closures?date=${date}`);
        if (closureRes.ok) {
          const { closure } = await closureRes.json();
          if (closure) {
            setPendingFormData(fd);
            setClosureWarning(closure.reason);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Closure check failed — proceed anyway
      }

      await proceedWithBooking(fd);
    } catch {
      // errors handled in proceedWithBooking
      setLoading(false);
    }
  };

  const teacherOptions = teachers
    .filter((t) => t.id !== teacherId)
    .map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }));

  const primaryTeacherOptions = [
    { value: "__none__", label: "Select teacher..." },
    ...teachers.map((t) => ({
      value: t.id,
      label: `${t.first_name} ${t.last_name}`,
    })),
  ];

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
            {studioBookings.length > 0 && (
              <div className="mt-1 p-2 bg-gray-50 rounded text-xs space-y-1">
                <div className="font-medium text-mist">Also booked in {studio}:</div>
                {studioBookings.map((b: any) => (
                  <div key={b.id} className="flex justify-between">
                    <span className="text-charcoal truncate">{b.name}</span>
                    <span className="text-mist shrink-0 ml-2">{formatTime(b.start_time)}–{formatTime(b.end_time)}</span>
                  </div>
                ))}
              </div>
            )}
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
                    {creditInfo.find(c => c.studentId === id) && (() => {
                      const ci = creditInfo.find(c => c.studentId === id)!;
                      return (
                        <span className={`text-[10px] ml-1 ${ci.sufficient ? "text-success" : "text-gold-dark"}`}>
                          ({ci.balance} credits{!ci.sufficient ? ` — needs ${ci.pointCost}` : ""})
                        </span>
                      );
                    })()}
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
                    {(s.is_adult || !s.family_id) && <span className="text-xs text-mist ml-1">(Adult)</span>}
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
              options={[{ value: "__none__", label: "None" }, ...teacherOptions]}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Student / Parent Notes</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-mist">Visible to:</span>
                <select
                  value={noteVisibility}
                  onChange={(e) => setNoteVisibility(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1"
                >
                  <option value="parent_only">Parent only</option>
                  <option value="student_and_parent">Student + Parent</option>
                  <option value="student_only">Student only</option>
                </select>
              </div>
            </div>
            <textarea
              rows={2}
              value={parentVisibleNotes}
              onChange={(e) => setParentVisibleNotes(e.target.value)}
              className={inputCls}
              placeholder={
                noteVisibility === "student_only"
                  ? "Visible to student only..."
                  : noteVisibility === "student_and_parent"
                  ? "Visible to student and parent..."
                  : "Visible to parent only..."
              }
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

      {/* Closure warning dialog */}
      <AlertDialog open={!!closureWarning} onOpenChange={() => setClosureWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Studio Closed on This Date</AlertDialogTitle>
            <AlertDialogDescription>
              The studio is closed on this date ({closureWarning}).
              Are you sure you want to schedule a private lesson?
              The student and teacher will need to arrange access separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setClosureWarning(null); setPendingFormData(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingFormData) proceedWithBooking(pendingFormData); }}>
              Schedule Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
