"use client";

import { useState, useTransition } from "react";
import { markTeacherAbsent } from "@/lib/schedule/actions";

export function AbsentButton({ sessionId }: { sessionId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleConfirm() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await markTeacherAbsent(sessionId);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDone(true);
        setShowModal(false);
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center rounded-lg border border-[#C45B5B]/30 bg-[#C45B5B]/10 px-4 py-2 text-sm font-medium text-[#C45B5B]">
        Marked Absent
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="shrink-0 h-9 rounded-lg border border-[#C45B5B] px-4 text-sm font-semibold text-[#C45B5B] hover:bg-[#C45B5B]/10 transition-colors"
      >
        Mark Me Absent
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md mx-auto w-full shadow-xl">
            <h3 className="text-lg font-heading font-semibold text-[#2D2A33] mb-2">
              Mark Yourself Absent
            </h3>
            <p className="text-sm text-[#5A5662] mb-6">
              Mark yourself absent for this session? Admin will be notified to
              find coverage.
            </p>

            {errorMsg && (
              <div className="rounded-lg bg-[#C45B5B]/10 border border-[#C45B5B]/20 px-4 py-3 mb-4">
                <p className="text-sm text-[#C45B5B]">{errorMsg}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="h-9 rounded-lg px-4 text-sm font-semibold text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="h-9 rounded-lg bg-[#C45B5B] px-4 text-sm font-semibold text-white hover:bg-[#A34848] transition-colors disabled:opacity-50"
              >
                {isPending ? "Submitting..." : "Confirm Absent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
