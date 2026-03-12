import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${dh}:${m} ${ampm}`;
}

export default async function SubstituteRequestsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("substitute_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // Enrich with instance and teacher info
  const instanceIds = [...new Set((requests ?? []).map((r) => r.instance_id))];
  const teacherIds = [
    ...new Set(
      (requests ?? [])
        .flatMap((r) => [r.requesting_teacher_id, r.filled_by])
        .filter(Boolean) as string[]
    ),
  ];

  const instanceMap: Record<string, Record<string, unknown>> = {};
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("schedule_instances")
      .select("id, event_date, start_time, end_time, class_id")
      .in("id", instanceIds);
    for (const i of instances ?? []) instanceMap[i.id] = i;
  }

  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  const classIds = [
    ...new Set(
      Object.values(instanceMap)
        .map((i) => i.class_id as string)
        .filter(Boolean)
    ),
  ];
  const classNames: Record<string, string> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    for (const c of classes ?? []) classNames[c.id] = c.name;
  }

  const openCount = (requests ?? []).filter((r) => r.status === "open").length;

  const statusColor: Record<string, string> = {
    open: "bg-warning/10 text-warning",
    filled: "bg-success/10 text-success",
    cancelled: "bg-cloud text-slate",
    unfilled: "bg-error/10 text-error",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Substitute Requests
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage teacher absence reports and substitute assignments
        </p>
      </div>

      {openCount > 0 && (
        <div className="rounded-xl bg-warning/10 border border-warning/20 px-4 py-3">
          <p className="text-sm font-medium text-warning">
            {openCount} open request{openCount !== 1 ? "s" : ""} pending
            substitute assignment
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Open" value={openCount} />
        <StatCard
          label="Filled"
          value={(requests ?? []).filter((r) => r.status === "filled").length}
        />
        <StatCard
          label="Unfilled"
          value={(requests ?? []).filter((r) => r.status === "unfilled").length}
        />
        <StatCard label="Total" value={requests?.length ?? 0} />
      </div>

      {requests && requests.length > 0 ? (
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {requests.map((req) => {
            const inst = instanceMap[req.instance_id];
            const className = inst?.class_id
              ? classNames[inst.class_id as string] ?? "Unknown"
              : "Unknown";

            return (
              <div key={req.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[req.status] ?? "bg-cloud text-slate"}`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-charcoal truncate">
                      {className}
                    </h3>
                    <p className="text-sm text-slate mt-0.5">
                      {inst?.event_date
                        ? new Date(
                            (inst.event_date as string) + "T00:00:00"
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                      {typeof inst?.start_time === "string" &&
                        typeof inst?.end_time === "string" && (
                        <>
                          {" "}
                          &middot; {formatTime(inst.start_time)} –{" "}
                          {formatTime(inst.end_time)}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-mist mt-0.5">
                      Reported by{" "}
                      {teacherNames[req.requesting_teacher_id] ?? "Unknown"}
                      {req.reason && (
                        <span className="text-mist"> — {req.reason}</span>
                      )}
                    </p>
                    {req.filled_by && (
                      <p className="text-xs text-success mt-0.5">
                        Filled by {teacherNames[req.filled_by] ?? "Unknown"}
                      </p>
                    )}
                  </div>
                  {req.status === "open" && (
                    <ApproveButton requestId={req.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No substitute requests yet</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4 text-center">
      <p className="text-2xl font-heading font-semibold text-charcoal">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );
}

function ApproveButton({ requestId }: { requestId: string }) {
  return (
    <a
      href={`/admin/substitute-requests?approve=${requestId}`}
      className="rounded-lg bg-lavender px-3 py-1.5 text-sm font-medium text-white hover:bg-lavender-dark transition-colors inline-block"
    >
      Approve &amp; Alert Subs
    </a>
  );
}
