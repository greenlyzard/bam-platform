"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Thread {
  id: string;
  subject: string | null;
  state: string;
  priority: string;
  contact_name: string | null;
  contact_email: string | null;
  message_count: number;
  last_message_at: string;
  last_message?: {
    preview: string;
    direction: string;
    sender_name: string | null;
  } | null;
}

interface CommunicationsTabProps {
  familyId?: string;
  leadId?: string;
}

export function CommunicationsTab({ familyId, leadId }: CommunicationsTabProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams({ state: "all" });
      if (familyId) params.set("family_id", familyId);
      if (leadId) params.set("lead_id", leadId);

      try {
        const res = await fetch(`/api/communications/threads?${params}`);
        if (res.ok) {
          const data = await res.json();
          setThreads(data.threads ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [familyId, leadId]);

  const stateBadgeClass: Record<string, string> = {
    open: "bg-green-100 text-green-700",
    resolved: "bg-gray-100 text-gray-600",
    archived: "bg-gray-100 text-gray-400",
    spam: "bg-red-100 text-red-600",
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-heading text-lg font-semibold text-gray-900">Communications</h3>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-gray-900">Communications</h3>
        <Link
          href={`/admin/communications/inbox${familyId ? `?family_id=${familyId}` : leadId ? `?lead_id=${leadId}` : ""}`}
          className="text-sm text-[#9C8BBF] hover:text-[#6B5A99]"
        >
          View in Inbox
        </Link>
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-gray-500">No communication threads yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/admin/communications/inbox?thread=${t.id}`}
              className="flex items-start gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {t.subject || "(No subject)"}
                  </span>
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${stateBadgeClass[t.state] ?? "bg-gray-100 text-gray-600"}`}>
                    {t.state}
                  </span>
                  {t.priority === "flagged" && (
                    <span className="text-amber-500 text-xs">&#9873;</span>
                  )}
                  {t.priority === "urgent" && (
                    <span className="text-red-500 text-xs">&#9873;</span>
                  )}
                </div>
                {t.last_message && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {t.last_message.direction === "outbound" ? "You: " : ""}
                    {t.last_message.preview}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="whitespace-nowrap text-[10px] text-gray-400">
                  {new Date(t.last_message_at).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-gray-400">{t.message_count} msg</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
