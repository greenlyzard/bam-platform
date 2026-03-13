"use client";

import { useState } from "react";
import {
  approveTimesheet,
  returnTimesheet,
  flagTimesheetEntry,
  approveTimesheetEntry,
} from "./actions";

// ── Timesheet-level approve/return (existing) ─────────────
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

// ── Entry-level actions ───────────────────────────────────
export function EntryApproveButton({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <form
      action={async (fd) => {
        setLoading(true);
        await approveTimesheetEntry(fd);
        setLoading(false);
      }}
    >
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        disabled={loading}
        className="h-7 rounded-md bg-success/90 hover:bg-success text-white font-medium text-[11px] px-2.5 transition-colors disabled:opacity-50"
      >
        {loading ? "..." : "Approve"}
      </button>
    </form>
  );
}

export function EntryFlagButton({
  entryId,
  teacherName,
}: {
  entryId: string;
  teacherName: string;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-7 rounded-md border border-warning/40 text-warning hover:bg-warning/5 font-medium text-[11px] px-2.5 transition-colors"
      >
        Flag
      </button>
    );
  }

  return (
    <div className="space-y-2 min-w-[200px]">
      <form
        action={async (fd) => {
          setLoading(true);
          setError("");
          const result = await flagTimesheetEntry(fd);
          setLoading(false);
          if (result?.error) setError(result.error);
          else setOpen(false);
        }}
      >
        <input type="hidden" name="entryId" value={entryId} />
        <label className="block text-[11px] text-slate mb-1">
          Question for {teacherName}:
        </label>
        <textarea
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Was this the makeup class or the regular session?"
          rows={2}
          required
          className="w-full rounded-md border border-silver px-2 py-1 text-xs text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none resize-none"
        />
        {error && <p className="text-[11px] text-error">{error}</p>}
        <div className="flex gap-1.5 mt-1.5">
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="h-6 rounded-md bg-warning/90 hover:bg-warning text-white font-medium text-[11px] px-2 disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-6 rounded-md border border-silver text-slate text-[11px] px-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Change log display ────────────────────────────────────
interface ChangeLogEntry {
  id: string;
  change_type: string;
  changed_by_name: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

export function EntryChangeLog({ changes }: { changes: ChangeLogEntry[] }) {
  const [open, setOpen] = useState(false);

  if (changes.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-lavender hover:text-lavender-dark font-medium"
      >
        History ({changes.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {changes.map((c) => (
            <div key={c.id} className="text-[11px] text-slate flex gap-2">
              <span className="text-mist whitespace-nowrap shrink-0">
                {new Date(c.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="font-medium text-charcoal shrink-0">
                {c.changed_by_name ?? "System"}
              </span>
              <span>
                {c.change_type === "created" && "Created entry"}
                {c.change_type === "submitted" && "Submitted for approval"}
                {c.change_type === "approved" && "Approved"}
                {c.change_type === "flagged" && (
                  <>Flagged: &ldquo;{c.note}&rdquo;</>
                )}
                {c.change_type === "flag_responded" && (
                  <>Responded: &ldquo;{c.note}&rdquo;</>
                )}
                {c.change_type === "adjusted" && (
                  <>
                    Adjusted{c.field_changed ? ` ${c.field_changed}` : ""}
                    {c.old_value && c.new_value && (
                      <>
                        : {c.old_value} → {c.new_value}
                      </>
                    )}
                    {c.note && <> — {c.note}</>}
                  </>
                )}
                {c.change_type === "edited" && (
                  <>
                    Edited{c.field_changed ? ` ${c.field_changed}` : ""}
                    {c.old_value && c.new_value && (
                      <>
                        : {c.old_value} → {c.new_value}
                      </>
                    )}
                  </>
                )}
                {c.change_type === "deleted" && "Deleted entry"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
