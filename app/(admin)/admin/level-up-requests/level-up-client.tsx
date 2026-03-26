"use client";

import { useState, useTransition } from "react";
import { reviewLevelUp } from "@/app/(portal)/portal/enroll/actions";
import { SimpleSelect } from "@/components/ui/select";

type Req = {
  id: string;
  status: string;
  created_at: string;
  notes: string | null;
  students: { id: string; first_name: string; last_name: string };
  current_class: { id: string; name: string } | null;
  requested_class: { id: string; name: string } | null;
  requested_by: { first_name: string; last_name: string } | null;
};

const statusOpts = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "deferred", label: "Deferred" },
];

const badgeColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  deferred: "bg-gray-100 text-gray-600",
};

export function LevelUpClient({ requests }: { requests: Req[] }) {
  const [filter, setFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  function handleAction(id: string, status: "approved" | "denied" | "deferred") {
    const fd = new FormData();
    fd.set("requestId", id);
    fd.set("status", status);
    fd.set("notes", note);
    startTransition(async () => {
      await reviewLevelUp(fd);
      setActiveId(null);
      setNote("");
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">Level Up Requests</h1>
        <SimpleSelect value={filter} onValueChange={setFilter} options={statusOpts} placeholder="Filter status" />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate py-12 text-center">No requests found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-silver">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-charcoal">Student</th>
                <th className="px-4 py-2 font-medium text-charcoal">Current Class</th>
                <th className="px-4 py-2 font-medium text-charcoal">Requested Class</th>
                <th className="px-4 py-2 font-medium text-charcoal">Parent</th>
                <th className="px-4 py-2 font-medium text-charcoal">Date</th>
                <th className="px-4 py-2 font-medium text-charcoal">Status</th>
                <th className="px-4 py-2 font-medium text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver bg-white">
              {filtered.map((r) => {
                const s = Array.isArray(r.students) ? r.students[0] : r.students;
                const parent = Array.isArray(r.requested_by) ? r.requested_by[0] : r.requested_by;
                const cur = Array.isArray(r.current_class) ? r.current_class[0] : r.current_class;
                const req = Array.isArray(r.requested_class) ? r.requested_class[0] : r.requested_class;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{s?.first_name} {s?.last_name}</td>
                    <td className="px-4 py-2">{cur?.name ?? "—"}</td>
                    <td className="px-4 py-2">{req?.name ?? "—"}</td>
                    <td className="px-4 py-2">{parent ? `${parent.first_name} ${parent.last_name}` : "—"}</td>
                    <td className="px-4 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "pending" && activeId !== r.id && (
                        <button onClick={() => setActiveId(r.id)} className="text-xs text-lavender hover:text-lavender-dark font-medium">
                          Review
                        </button>
                      )}
                      {activeId === r.id && (
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="border border-silver rounded px-2 py-1 text-xs w-full"
                          />
                          <div className="flex gap-1.5">
                            <button disabled={isPending} onClick={() => handleAction(r.id, "approved")} className="rounded bg-green-600 text-white px-2 py-0.5 text-xs hover:bg-green-700 disabled:opacity-50">Approve</button>
                            <button disabled={isPending} onClick={() => handleAction(r.id, "denied")} className="rounded bg-red-600 text-white px-2 py-0.5 text-xs hover:bg-red-700 disabled:opacity-50">Deny</button>
                            <button disabled={isPending} onClick={() => handleAction(r.id, "deferred")} className="rounded bg-gray-400 text-white px-2 py-0.5 text-xs hover:bg-gray-500 disabled:opacity-50">Defer</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
