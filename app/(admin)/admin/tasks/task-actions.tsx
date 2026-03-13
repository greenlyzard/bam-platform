"use client";

import { useState, useTransition } from "react";
import {
  resolveTask,
  dismissTask,
  setCancellationPayDecision,
} from "@/lib/schedule/actions";
import type { AdminTask } from "@/lib/schedule/types";

export function TaskActions({ task }: { task: AdminTask }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {task.task_type === "cancellation_pay_decision" &&
        task.related_session_id && (
          <PayDecisionButtons
            taskId={task.id}
            sessionId={task.related_session_id}
          />
        )}

      {task.task_type === "class_at_risk" && task.related_class_id && (
        <a
          href={`/admin/schedule/classes/${task.related_class_id}`}
          className="h-9 inline-flex items-center rounded-lg border border-lavender px-4 text-sm font-semibold text-lavender hover:bg-lavender/10 transition-colors"
        >
          Send Recruitment
        </a>
      )}

      {task.task_type !== "cancellation_pay_decision" && (
        <>
          <ResolveButton taskId={task.id} />
          <DismissButton taskId={task.id} />
        </>
      )}
    </div>
  );
}

function ResolveButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleResolve() {
    startTransition(async () => {
      const result = await resolveTask(taskId);
      if (!result.error) setDone(true);
    });
  }

  if (done) {
    return (
      <span className="text-xs font-medium text-success">Resolved</span>
    );
  }

  return (
    <button
      onClick={handleResolve}
      disabled={isPending}
      className="h-9 rounded-lg bg-success/10 px-4 text-sm font-semibold text-success hover:bg-success/20 transition-colors disabled:opacity-50"
    >
      {isPending ? "..." : "Resolve"}
    </button>
  );
}

function DismissButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissTask(taskId);
      if (!result.error) setDone(true);
    });
  }

  if (done) {
    return (
      <span className="text-xs font-medium text-mist">Dismissed</span>
    );
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={isPending}
      className="h-9 rounded-lg bg-cloud px-4 text-sm font-semibold text-slate hover:bg-silver/50 transition-colors disabled:opacity-50"
    >
      {isPending ? "..." : "Dismiss"}
    </button>
  );
}

function PayDecisionButtons({
  taskId,
  sessionId,
}: {
  taskId: string;
  sessionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [decided, setDecided] = useState<string | null>(null);

  function handleDecision(decision: string) {
    startTransition(async () => {
      const result = await setCancellationPayDecision(sessionId, decision);
      if (!result.error) setDecided(decision);
    });
  }

  if (decided) {
    const labels: Record<string, string> = {
      full_pay: "Full Pay",
      reduced_pay: "Reduced",
      no_pay: "No Pay",
    };
    return (
      <span className="text-xs font-medium text-success">
        Decision: {labels[decided] ?? decided}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => handleDecision("full_pay")}
        disabled={isPending}
        className="h-9 rounded-lg bg-success/10 px-3 text-sm font-semibold text-success hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        Pay Full
      </button>
      <button
        onClick={() => handleDecision("reduced_pay")}
        disabled={isPending}
        className="h-9 rounded-lg bg-warning/10 px-3 text-sm font-semibold text-warning hover:bg-warning/20 transition-colors disabled:opacity-50"
      >
        Pay Reduced
      </button>
      <button
        onClick={() => handleDecision("no_pay")}
        disabled={isPending}
        className="h-9 rounded-lg bg-error/10 px-3 text-sm font-semibold text-error hover:bg-error/20 transition-colors disabled:opacity-50"
      >
        No Pay
      </button>
    </div>
  );
}
