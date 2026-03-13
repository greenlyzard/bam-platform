"use client";

import { useState } from "react";
import { approveTimesheet, returnTimesheet } from "./actions";

export function ReviewActions({ timesheetId }: { timesheetId: string }) {
  const [loading, setLoading] = useState(false);
  const [returning, setReturning] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function handleApprove(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await approveTimesheet(formData);
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  async function handleReturn(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await returnTimesheet(formData);
    setLoading(false);
    if (result?.error) setError(result.error);
    else setReturning(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-error">{error}</p>}

      {!returning ? (
        <div className="flex gap-2">
          <form action={handleApprove}>
            <input type="hidden" name="timesheetId" value={timesheetId} />
            <button
              type="submit"
              disabled={loading}
              className="h-8 rounded-md bg-success/90 hover:bg-success text-white font-medium text-xs px-3 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Approve"}
            </button>
          </form>
          <button
            onClick={() => setReturning(true)}
            className="h-8 rounded-md border border-error/30 text-error hover:bg-error/5 font-medium text-xs px-3 transition-colors"
          >
            Return
          </button>
        </div>
      ) : (
        <form action={handleReturn} className="space-y-2">
          <input type="hidden" name="timesheetId" value={timesheetId} />
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for return..."
            rows={2}
            className="w-full rounded-md border border-silver px-2 py-1 text-xs text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="h-7 rounded-md bg-error/90 hover:bg-error text-white font-medium text-xs px-3 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Confirm Return"}
            </button>
            <button
              type="button"
              onClick={() => setReturning(false)}
              className="h-7 rounded-md border border-silver text-slate text-xs px-3"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
