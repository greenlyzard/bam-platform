"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { requestEnrollment } from "./actions";

interface ClassInfo {
  id: string;
  name: string;
  style: string;
  level: string;
  description: string | null;
  ageMin: number | null;
  ageMax: number | null;
  maxStudents: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacherName: string | null;
  activeCount: number;
  spotsRemaining: number;
  isFull: boolean;
}

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  trial_used: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STYLE_LABELS: Record<string, string> = {
  ballet: "Ballet",
  pre_ballet: "Pre-Ballet",
  creative_movement: "Creative Movement",
  pointe: "Pointe",
  jazz: "Jazz",
  contemporary: "Contemporary",
  lyrical: "Lyrical",
  musical_theatre: "Musical Theatre",
  hip_hop: "Hip Hop",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function calculateAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function ClassBrowser({
  classes,
  students,
  initialStudentId,
  initialType,
}: {
  classes: ClassInfo[];
  students: StudentInfo[];
  initialStudentId?: string;
  initialType?: "trial";
}) {
  const [selectedStudent, setSelectedStudent] = useState<string>(
    (initialStudentId && students.some((s) => s.id === initialStudentId) ? initialStudentId : students[0]?.id) ?? ""
  );
  const [styleFilter, setStyleFilter] = useState<string>("");
  const [dayFilter, setDayFilter] = useState<string>("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const student = students.find((s) => s.id === selectedStudent);
  const studentAge = student ? calculateAge(student.date_of_birth) : null;

  // Filter classes
  let filtered = classes;

  // Age filter based on selected student
  if (studentAge !== null) {
    filtered = filtered.filter((cls) => {
      if (cls.ageMin !== null && studentAge < cls.ageMin - 1) return false;
      if (cls.ageMax !== null && studentAge > cls.ageMax + 1) return false;
      return true;
    });
  }

  if (styleFilter) {
    filtered = filtered.filter((cls) => cls.style === styleFilter);
  }

  if (dayFilter) {
    filtered = filtered.filter(
      (cls) => cls.dayOfWeek === parseInt(dayFilter, 10)
    );
  }

  // Get unique styles for filter
  const availableStyles = [...new Set(classes.map((c) => c.style))].sort();

  async function handleRequest(
    classId: string,
    requestType: "enrollment_request" | "trial_request"
  ) {
    if (!selectedStudent) {
      setMessage({
        type: "error",
        text: "Please select a dancer first.",
      });
      return;
    }

    setSubmitting(`${classId}-${requestType}`);
    setMessage(null);

    const fd = new FormData();
    fd.set("studentId", selectedStudent);
    fd.set("classId", classId);
    fd.set("requestType", requestType);

    const result = await requestEnrollment(fd);
    setSubmitting(null);

    if ("error" in result && result.error) {
      setMessage({ type: "error", text: result.error });
    } else if ("message" in result && result.message) {
      setMessage({ type: "success", text: result.message });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border border-silver bg-white p-4 space-y-3">
        {students.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Enrolling for
            </label>
            <SimpleSelect
              value={selectedStudent}
              onValueChange={(val) => {
                setSelectedStudent(val);
                setMessage(null);
              }}
              options={students.map((s) => ({
                value: s.id,
                label: `${s.first_name} ${s.last_name} (age ${calculateAge(s.date_of_birth)})`,
              }))}
              className="w-full"
            />
          </div>
        )}

        {students.length === 0 && (
          <div className="rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/20 px-4 py-3 text-sm text-[#D4A843]">
            Please{" "}
            <a
              href="/portal/students"
              className="underline font-medium"
            >
              add a dancer
            </a>{" "}
            first before browsing classes.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Style
            </label>
            <SimpleSelect
              value={styleFilter}
              onValueChange={setStyleFilter}
              options={availableStyles.map((s) => ({
                value: s,
                label: STYLE_LABELS[s] ?? s,
              }))}
              placeholder="All styles"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Day
            </label>
            <SimpleSelect
              value={dayFilter}
              onValueChange={setDayFilter}
              options={DAYS.map((d, i) => ({
                value: String(i),
                label: d,
              }))}
              placeholder="All days"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-[#5A9E6F]/10 border-[#5A9E6F]/20 text-[#5A9E6F]"
              : "bg-[#C45B5B]/10 border-[#C45B5B]/20 text-[#C45B5B]"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-mist">
        {filtered.length} {filtered.length === 1 ? "class" : "classes"}{" "}
        {studentAge !== null ? `for age ${studentAge}` : "available"}
      </p>

      {/* Class cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white p-8 text-center">
          <p className="text-sm text-mist">
            No classes found matching your filters.
            {studentAge !== null &&
              " Try removing the age filter by selecting a different dancer."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((cls) => (
            <div
              key={cls.id}
              className="rounded-xl border border-silver bg-white p-5 space-y-3"
            >
              <div>
                <h3 className="font-heading text-base font-semibold text-charcoal">
                  {cls.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block rounded-full bg-lavender/10 text-lavender-dark px-2 py-0.5 text-xs font-medium">
                    {STYLE_LABELS[cls.style] ?? cls.style}
                  </span>
                  <span className="text-xs text-mist capitalize">
                    {cls.level}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="text-mist text-xs">Day & Time</dt>
                  <dd className="text-charcoal">
                    {DAYS[cls.dayOfWeek]} {formatTime(cls.startTime)} -{" "}
                    {formatTime(cls.endTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Instructor</dt>
                  <dd className="text-charcoal">
                    {cls.teacherName ?? "TBD"}
                  </dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Ages</dt>
                  <dd className="text-charcoal">
                    {cls.ageMin ?? "Any"} - {cls.ageMax ?? "Any"}
                  </dd>
                </div>
                <div>
                  <dt className="text-mist text-xs">Open Spots</dt>
                  <dd
                    className={
                      cls.isFull ? "text-[#C45B5B] font-medium" : "text-charcoal"
                    }
                  >
                    {cls.isFull
                      ? "Full"
                      : `${cls.spotsRemaining} of ${cls.maxStudents}`}
                  </dd>
                </div>
              </dl>

              {cls.description && (
                <p className="text-xs text-mist line-clamp-2">
                  {cls.description}
                </p>
              )}

              {students.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() =>
                      handleRequest(cls.id, "enrollment_request")
                    }
                    disabled={submitting !== null}
                    className="flex-1 h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting === `${cls.id}-enrollment_request`
                      ? "Submitting..."
                      : cls.isFull
                        ? "Join Waitlist"
                        : "Request Enrollment"}
                  </button>
                  {!student?.trial_used && (
                    <button
                      onClick={() =>
                        handleRequest(cls.id, "trial_request")
                      }
                      disabled={submitting !== null}
                      className="h-9 rounded-lg border border-lavender text-lavender hover:bg-lavender/5 text-sm font-semibold px-4 transition-colors disabled:opacity-50"
                    >
                      {submitting === `${cls.id}-trial_request`
                        ? "..."
                        : "Trial"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
