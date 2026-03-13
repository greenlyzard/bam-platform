"use client";

import { useState } from "react";
import { submitTimesheet } from "../actions";

export function SubmitFromSummary({
  timesheetId,
  totalHours,
  entryCount,
}: {
  timesheetId: string;
  totalHours: number;
  entryCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await submitTimesheet(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="rounded-xl border-2 border-lavender bg-lavender/5 p-5">
      <h3 className="font-heading text-lg font-semibold text-charcoal">
        Submit Timesheet
      </h3>
      <p className="text-sm text-slate mt-1 mb-4">
        You are submitting <strong>{entryCount}</strong>{" "}
        {entryCount === 1 ? "entry" : "entries"} totalling{" "}
        <strong>{totalHours.toFixed(1)} hours</strong>. Once submitted, you will
        not be able to edit entries until an admin returns the timesheet.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="flex gap-3">
        <input type="hidden" name="timesheetId" value={timesheetId} />
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Timesheet"}
        </button>
        <a
          href="/teach/timesheets"
          className="inline-flex items-center h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors"
        >
          Go Back
        </a>
      </form>
    </div>
  );
}
