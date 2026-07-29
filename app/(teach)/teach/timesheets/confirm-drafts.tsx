"use client";

import { useState } from "react";
import { confirmAllAutoDrafts } from "./actions";

/**
 * Period-level "Confirm all" for auto-drafted entries.
 *
 * Deliberately worded as accepting what the schedule proposed, not as a
 * blanket approval: the action only touches rows that are still awaiting a
 * decision, and a teacher who has already adjusted or deleted something keeps
 * that. Anything they did not want confirmed should be edited or deleted
 * first — which the copy says, because a bulk control that quietly includes
 * rows the person has not looked at is how wrong hours get submitted.
 */
export function ConfirmAllDrafts({
  timesheetId,
  count,
}: {
  timesheetId: string;
  count: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="rounded-xl border border-lavender/30 bg-lavender/5 p-4">
      <form
        action={async (fd: FormData) => {
          setBusy(true);
          setError("");
          const result = await confirmAllAutoDrafts(fd);
          setBusy(false);
          if (result?.error) setError(result.error);
        }}
        className="flex items-center justify-between gap-4 flex-wrap"
      >
        <input type="hidden" name="timesheetId" value={timesheetId} />
        <div>
          <p className="text-sm font-semibold text-charcoal">
            {count} scheduled {count === 1 ? "entry" : "entries"} awaiting your
            confirmation
          </p>
          <p className="text-xs text-slate mt-0.5">
            Edit or delete anything that did not happen as scheduled before
            confirming.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5 transition-colors disabled:opacity-50 shrink-0"
        >
          {busy ? "Confirming…" : "Confirm all"}
        </button>
      </form>
      {error && <p className="text-xs text-error mt-2">{error}</p>}
    </div>
  );
}
