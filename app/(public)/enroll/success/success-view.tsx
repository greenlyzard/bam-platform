"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

interface EnrolledClass {
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  teacher_name: string | null;
}

export function SuccessView() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Fetch enrollment details from the session
    fetch(`/api/enrollment/success?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.classes) setClasses(data.classes);
      })
      .catch(() => {
        // Non-fatal — show generic success
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
        <p className="mt-4 text-sm text-slate">
          Confirming your enrollment...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center py-8">
      {/* Checkmark */}
      <div className="mx-auto h-16 w-16 rounded-full bg-lavender/10 flex items-center justify-center">
        <svg
          className="h-8 w-8 text-lavender"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>

      <h2 className="font-heading text-2xl font-semibold text-charcoal">
        You&apos;re enrolled!
      </h2>

      <p className="text-sm text-slate max-w-md mx-auto">
        Your enrollment is confirmed and payment has been processed.
      </p>

      {/* Enrolled classes */}
      {classes.length > 0 && (
        <div className="text-left max-w-md mx-auto space-y-2">
          {classes.map((cls, i) => (
            <div
              key={i}
              className="rounded-xl border border-silver bg-white p-4"
            >
              <p className="text-sm font-semibold text-charcoal">
                {cls.class_name}
              </p>
              <p className="text-xs text-slate mt-1">
                {DAYS[cls.day_of_week]}s &middot;{" "}
                {formatTime(cls.start_time)}&ndash;
                {formatTime(cls.end_time)}
                {cls.teacher_name && ` · ${cls.teacher_name}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* What happens next */}
      <div className="text-left max-w-md mx-auto rounded-xl border border-lavender/20 bg-lavender/5 p-5">
        <h3 className="font-heading text-base font-semibold text-charcoal mb-3">
          What happens next
        </h3>
        <ul className="space-y-2 text-sm text-slate">
          <li className="flex gap-2">
            <span className="text-lavender shrink-0">&#10003;</span>
            You&apos;ll receive a confirmation email shortly
          </li>
          <li className="flex gap-2">
            <span className="text-lavender shrink-0">&#10003;</span>
            Class details and schedule are in your parent portal
          </li>
          <li className="flex gap-2">
            <span className="text-lavender shrink-0">&#10003;</span>
            Your first class is a free trial &mdash; full refund if it&apos;s
            not the right fit
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-3 max-w-xs mx-auto">
        <Link
          href="/portal/dashboard"
          className="flex h-12 items-center justify-center rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm transition-colors w-full"
        >
          Go to Parent Portal
        </Link>
        <Link
          href="/enroll"
          className="flex h-11 items-center justify-center text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          Enroll Another Child
        </Link>
      </div>
    </div>
  );
}
