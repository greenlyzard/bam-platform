"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import {
  approveTimesheet,
  returnTimesheet,
  flagTimesheetEntry,
  approveTimesheetEntry,
  rateOverrideEntry,
  respondToFlag,
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

// ── Rate Override Component ───────────────────────────────────
export function EntryRateOverride({
  entryId,
  currentRate,
}: {
  entryId: string;
  currentRate: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(currentRate?.toString() ?? "");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("Admin Decision");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("newRate", rate);
    fd.set("reason", reason);
    fd.set("source", source);
    const result = await rateOverrideEntry(fd);
    setLoading(false);
    if (result?.error) setError(result.error);
    else setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-lavender hover:text-lavender-dark">
        Override rate
      </button>
    );
  }

  return (
    <div className="mt-2 p-2 rounded border border-silver/50 bg-cloud/30 space-y-2">
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="New rate"
          className="w-24 h-7 rounded border border-silver px-2 text-xs text-charcoal focus:border-lavender focus:outline-none"
        />
        <SimpleSelect
          value={source}
          onValueChange={setSource}
          options={[
            { value: "Admin Decision", label: "Admin Decision" },
            { value: "Verbal Agreement", label: "Verbal Agreement" },
            { value: "Email", label: "Email" },
            { value: "Text", label: "Text" },
            { value: "In System", label: "In System" },
          ]}
          className="w-36"
        />
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for override..."
        className="w-full h-7 rounded border border-silver px-2 text-xs text-charcoal focus:border-lavender focus:outline-none"
      />
      {error && <p className="text-[10px] text-error">{error}</p>}
      <div className="flex gap-1">
        <button onClick={handleSave} disabled={loading} className="h-6 rounded bg-lavender text-white text-[10px] font-semibold px-2 disabled:opacity-50">Save</button>
        <button onClick={() => setOpen(false)} className="h-6 rounded border border-silver text-[10px] text-slate px-2">Cancel</button>
      </div>
    </div>
  );
}

// ── Teacher Flag Response Component ──────────────────────────
export function EntryFlagResponse({
  entryId,
  flagQuestion,
}: {
  entryId: string;
  flagQuestion: string;
}) {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!response.trim()) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("response", response);
    const result = await respondToFlag(fd);
    setLoading(false);
    if (result?.error) setError(result.error);
    else setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-2 p-2 rounded border border-success/30 bg-success/5 text-xs text-success">
        Response submitted — entry returned to review queue.
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-error/20 bg-error/5 space-y-2">
      <p className="text-xs font-semibold text-error">Question from Amanda:</p>
      <p className="text-xs text-charcoal italic">&ldquo;{flagQuestion}&rdquo;</p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Type your response..."
        rows={2}
        className="w-full rounded border border-silver px-2 py-1.5 text-xs text-charcoal focus:border-lavender focus:outline-none resize-none"
      />
      {error && <p className="text-[10px] text-error">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading || !response.trim()}
        className="h-7 rounded bg-lavender hover:bg-lavender-dark text-white text-xs font-semibold px-3 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Response"}
      </button>
    </div>
  );
}
