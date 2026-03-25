"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";

export function TaskFilters({
  taskType: initialTaskType,
  priority: initialPriority,
  status: initialStatus,
  hasFilters,
}: {
  taskType: string;
  priority: string;
  status: string;
  hasFilters: boolean;
}) {
  const [taskType, setTaskType] = useState(initialTaskType || "all");
  const [priority, setPriority] = useState(initialPriority || "all");
  const [status, setStatus] = useState(initialStatus || "all");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="taskType" value={taskType === "all" ? "" : taskType} />
        <SimpleSelect
          value={taskType}
          onValueChange={setTaskType}
          options={[
            { value: "all", label: "All Types" },
            { value: "makeup_needed", label: "Makeup Needed" },
            { value: "class_at_risk", label: "Class At Risk" },
            { value: "coverage_needed", label: "Coverage Needed" },
            { value: "cancellation_pay_decision", label: "Pay Decision" },
            { value: "timesheet_review", label: "Timesheet Review" },
            { value: "other", label: "Other" },
          ]}
        />

        <input type="hidden" name="priority" value={priority === "all" ? "" : priority} />
        <SimpleSelect
          value={priority}
          onValueChange={setPriority}
          options={[
            { value: "all", label: "All Priorities" },
            { value: "urgent", label: "Urgent" },
            { value: "normal", label: "Normal" },
            { value: "low", label: "Low" },
          ]}
        />

        <input type="hidden" name="status" value={status === "all" ? "" : status} />
        <SimpleSelect
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "all", label: "Open / In Progress" },
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]}
        />

        <button
          type="submit"
          className="h-9 rounded-lg bg-lavender px-4 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
        >
          Filter
        </button>

        {hasFilters && (
          <a
            href="/admin/tasks"
            className="h-9 inline-flex items-center rounded-lg px-3 text-sm font-medium text-slate hover:text-charcoal transition-colors"
          >
            Clear
          </a>
        )}
      </form>
    </div>
  );
}
