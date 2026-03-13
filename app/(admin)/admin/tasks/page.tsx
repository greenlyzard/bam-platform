import { requireAdmin } from "@/lib/auth/guards";
import {
  getAdminTasks,
  getOpenTaskCount,
  PRIORITY_BADGES,
  TASK_TYPE_LABELS,
} from "@/lib/schedule/queries";
import { TaskActions } from "./task-actions";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    taskType?: string;
    priority?: string;
    status?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const [tasks, openCount] = await Promise.all([
    getAdminTasks({
      taskType: params.taskType || undefined,
      priority: params.priority || undefined,
      status: params.status || undefined,
    }),
    getOpenTaskCount(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Task Queue
        </h1>
        <p className="mt-1 text-sm text-slate">
          {openCount} open task{openCount !== 1 ? "s" : ""} requiring attention
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex flex-wrap items-center gap-3">
          <select
            name="taskType"
            defaultValue={params.taskType ?? ""}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:outline-none focus:border-lavender"
          >
            <option value="">All Types</option>
            <option value="makeup_needed">Makeup Needed</option>
            <option value="class_at_risk">Class At Risk</option>
            <option value="coverage_needed">Coverage Needed</option>
            <option value="cancellation_pay_decision">Pay Decision</option>
            <option value="timesheet_review">Timesheet Review</option>
            <option value="other">Other</option>
          </select>

          <select
            name="priority"
            defaultValue={params.priority ?? ""}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:outline-none focus:border-lavender"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:outline-none focus:border-lavender"
          >
            <option value="">Open / In Progress</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>

          <button
            type="submit"
            className="h-9 rounded-lg bg-lavender px-4 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
          >
            Filter
          </button>

          {(params.taskType || params.priority || params.status) && (
            <a
              href="/admin/tasks"
              className="h-9 inline-flex items-center rounded-lg px-3 text-sm font-medium text-slate hover:text-charcoal transition-colors"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Tasks table */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No tasks match your filters</p>
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cloud/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate">Priority</th>
                <th className="px-4 py-3 font-medium text-slate">Type</th>
                <th className="px-4 py-3 font-medium text-slate">Title</th>
                <th className="px-4 py-3 font-medium text-slate">
                  Related Class
                </th>
                <th className="px-4 py-3 font-medium text-slate">Due Date</th>
                <th className="px-4 py-3 font-medium text-slate text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-cloud/30 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_BADGES[task.priority] ?? "bg-cloud text-slate"
                      }`}
                    >
                      {task.priority}
                      {task.task_type === "coverage_needed" &&
                        task.priority === "urgent" && (
                          <span className="ml-1">!</span>
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal">
                    {TASK_TYPE_LABELS[task.task_type] ?? task.task_type}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-charcoal">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-mist mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                      {task.teacherName && (
                        <p className="text-xs text-slate mt-0.5">
                          Teacher: {task.teacherName}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {task.className ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {formatDate(task.due_date)}
                  </td>
                  <td className="px-4 py-3">
                    <TaskActions task={task} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
