"use client";

import { useState, useTransition, useEffect } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { requestChanges, approveEvaluation, publishEvaluation } from "./actions";

type Evaluation = {
  id: string;
  studentName: string;
  className: string | null;
  teacherName: string;
  evaluatorId: string | null;
  status: string;
  title: string | null;
  evaluationType: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type FilterOption = { id: string; name: string };

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-cloud text-slate",
  submitted: "bg-gold/10 text-gold-dark",
  changes_requested: "bg-error/10 text-error",
  approved: "bg-info/10 text-info",
  published: "bg-success/10 text-success",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
];

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EvaluationReviewClient({
  evaluations,
  teachers,
  classes,
  templateSeeded,
}: {
  evaluations: Evaluation[];
  teachers: FilterOption[];
  classes: FilterOption[];
  templateSeeded?: boolean;
}) {
  const [classFilter, setClassFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (templateSeeded) showToast("success", "Evaluation templates seeded");
  }, [templateSeeded]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = evaluations.filter((ev) => {
    if (classFilter !== "all" && ev.className !== classes.find((c) => c.id === classFilter)?.name) return false;
    if (teacherFilter !== "all" && ev.evaluatorId !== teacherFilter) return false;
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    return true;
  });

  const handleRequestChanges = (evalId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("evaluation_id", evalId);
      fd.set("admin_note", adminNote);
      const result = await requestChanges(fd);
      if (result?.error) {
        showToast("error", result.error);
      } else {
        showToast("success", "Changes requested successfully");
        setExpandedRow(null);
        setAdminNote("");
      }
    });
  };

  const handleApprove = (evalId: string) => {
    if (!confirm("Approve this evaluation?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("evaluation_id", evalId);
      const result = await approveEvaluation(fd);
      if (result?.error) {
        showToast("error", result.error);
      } else {
        showToast("success", "Evaluation approved");
      }
    });
  };

  const handlePublish = (evalId: string) => {
    if (!confirm("Publish this evaluation? It will be visible to parents.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("evaluation_id", evalId);
      const result = await publishEvaluation(fd);
      if (result?.error) {
        showToast("error", result.error);
      } else {
        showToast("success", "Evaluation published");
      }
    });
  };

  const classOptions = [
    { value: "all", label: "All Classes" },
    ...classes.map((c) => ({ value: c.id, label: c.name })),
  ];

  const teacherOptions = [
    { value: "all", label: "All Teachers" },
    ...teachers.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success" ? "bg-success text-white" : "bg-error text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Evaluation Review
        </h1>
        <p className="text-sm text-slate mt-1">
          Review, approve, and publish teacher evaluations before they are visible to parents.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SimpleSelect
          value={classFilter}
          onValueChange={setClassFilter}
          options={classOptions}
          placeholder="All Classes"
        />
        <SimpleSelect
          value={teacherFilter}
          onValueChange={setTeacherFilter}
          options={teacherOptions}
          placeholder="All Teachers"
        />
        <SimpleSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_OPTIONS}
          placeholder="All Statuses"
        />
        <span className="text-sm text-mist ml-auto">
          {filtered.length} evaluation{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver bg-cloud/30">
                <th className="text-left px-4 py-3 font-medium text-slate">Student</th>
                <th className="text-left px-4 py-3 font-medium text-slate">Class</th>
                <th className="text-left px-4 py-3 font-medium text-slate">Teacher</th>
                <th className="text-left px-4 py-3 font-medium text-slate">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-slate">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-mist">
                    No evaluations match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-cloud/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-charcoal">{ev.studentName}</td>
                    <td className="px-4 py-3 text-slate">{ev.className ?? "-"}</td>
                    <td className="px-4 py-3 text-slate">{ev.teacherName}</td>
                    <td className="px-4 py-3 text-slate">{formatDate(ev.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_BADGES[ev.status] ?? "bg-cloud text-slate"
                        }`}
                      >
                        {ev.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(ev.status === "submitted" || ev.status === "changes_requested") && (
                          <>
                            <button
                              onClick={() => {
                                setExpandedRow(expandedRow === ev.id ? null : ev.id);
                                setAdminNote(ev.adminNote ?? "");
                              }}
                              disabled={isPending}
                              className="rounded-md border border-error/30 bg-error/5 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                            >
                              Request Changes
                            </button>
                            <button
                              onClick={() => handleApprove(ev.id)}
                              disabled={isPending}
                              className="rounded-md border border-info/30 bg-info/5 px-2.5 py-1 text-xs font-medium text-info hover:bg-info/10 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          </>
                        )}
                        {ev.status === "approved" && (
                          <button
                            onClick={() => handlePublish(ev.id)}
                            disabled={isPending}
                            className="rounded-md border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                          >
                            Publish
                          </button>
                        )}
                        {ev.status === "published" && (
                          <span className="text-xs text-mist">Published</span>
                        )}
                      </div>
                      {/* Inline note input for Request Changes */}
                      {expandedRow === ev.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="Note for teacher..."
                            className="flex-1 rounded-md border border-silver px-2.5 py-1.5 text-xs text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
                          />
                          <button
                            onClick={() => handleRequestChanges(ev.id)}
                            disabled={isPending}
                            className="rounded-md bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 transition-colors disabled:opacity-50"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => {
                              setExpandedRow(null);
                              setAdminNote("");
                            }}
                            className="text-xs text-mist hover:text-slate"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
