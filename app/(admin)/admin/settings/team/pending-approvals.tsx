"use client";

import { useState } from "react";
import { approveTeacher, rejectTeacher } from "./actions";

interface PendingMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

export function PendingApprovals({ members }: { members: PendingMember[] }) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleApprove(id: string) {
    setProcessing(id);
    setError("");
    const result = await approveTeacher(id);
    setProcessing(null);
    if (result?.error) setError(result.error);
  }

  async function handleReject(id: string) {
    setProcessing(id);
    setError("");
    const result = await rejectTeacher(id);
    setProcessing(null);
    if (result?.error) setError(result.error);
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
        Pending Approvals ({members.length})
      </h2>

      {error && (
        <div className="mb-3 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="rounded-xl border-2 border-gold/30 bg-gold/5 divide-y divide-gold/20">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-charcoal">
                {m.first_name} {m.last_name}
              </p>
              <p className="text-xs text-slate">
                {m.email} · Signed up {new Date(m.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={processing === m.id}
                onClick={() => handleApprove(m.id)}
                className="h-8 rounded-lg bg-success/90 hover:bg-success text-white text-xs font-semibold px-4 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={processing === m.id}
                onClick={() => handleReject(m.id)}
                className="h-8 rounded-lg bg-error/90 hover:bg-error text-white text-xs font-semibold px-4 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
