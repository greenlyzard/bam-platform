import { requireAdmin } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import {
  getScheduleClassById,
  getRecurrenceRules,
  CLASS_TYPE_COLORS,
} from "@/lib/schedule/queries";
import { createClient } from "@/lib/supabase/server";
import { getClassEnrollments } from "@/lib/queries/families";
import { EnrolledStudents } from "./enrolled-students";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cls = await getScheduleClassById(id);
  return {
    title: cls
      ? `${cls.simple_name || cls.full_name || cls.name} — Studio Admin`
      : "Class Detail",
  };
}

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-cloud text-slate",
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  cancelled: "bg-[#C45B5B]/10 text-[#C45B5B]",
  completed: "bg-[#9E99A7]/10 text-[#9E99A7]",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string | null) {
  if (!t) return "-";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [cls, recurrenceRules, classEnrollments] = await Promise.all([
    getScheduleClassById(id),
    getRecurrenceRules(id),
    getClassEnrollments(id),
  ]);

  if (!cls) notFound();

  // Fetch sessions for this class
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select(
      "id, session_date, start_time, end_time, status, is_cancelled, room, needs_coverage"
    )
    .eq("class_id", id)
    .order("session_date", { ascending: true })
    .limit(50);

  // Get assistant teacher names
  let assistantNames: string[] = [];
  if (cls.assistant_teacher_ids && cls.assistant_teacher_ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .in("id", cls.assistant_teacher_ids);
    assistantNames = (profiles ?? []).map(
      (p) => [p.first_name, p.last_name].filter(Boolean).join(" ")
    );
  }

  const displayName = cls.simple_name || cls.full_name || cls.name;
  const typeBadge =
    CLASS_TYPE_COLORS[cls.class_type] ?? CLASS_TYPE_COLORS.regular;
  const statusBadge = STATUS_BADGES[cls.status] ?? STATUS_BADGES.draft;

  const recurrence = recurrenceRules[0];
  const scheduleDays = recurrence?.days_of_week
    ? (recurrence.days_of_week as number[]).map((d: number) => DAY_NAMES[d]).join(", ")
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/admin/schedule/classes"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Classes
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">
              {displayName}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadge}`}
              >
                {cls.class_type}
              </span>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge}`}
              >
                {cls.status}
              </span>
              {cls.is_published && (
                <span className="inline-block rounded-full bg-[#5A9E6F]/10 text-[#5A9E6F] px-2.5 py-0.5 text-xs font-medium">
                  Published
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/admin/schedule/classes/${id}/edit`}
            className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 flex items-center transition-colors shrink-0"
          >
            Edit Class
          </Link>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identity */}
        <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Identity
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-mist text-xs">Full Name</dt>
              <dd className="text-charcoal">{cls.full_name || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Short Name</dt>
              <dd className="text-charcoal">{cls.short_name || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Parent-Facing Name</dt>
              <dd className="text-charcoal">{cls.simple_name || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Display Name</dt>
              <dd className="text-charcoal">{cls.display_name || "-"}</dd>
            </div>
          </dl>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-mist text-xs">Program</dt>
              <dd className="text-charcoal capitalize">
                {cls.program_division || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Levels</dt>
              <dd className="text-charcoal">
                {cls.levels && cls.levels.length > 0
                  ? cls.levels.join(", ")
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Age Range</dt>
              <dd className="text-charcoal">
                {cls.min_age || cls.max_age
                  ? `${cls.min_age ?? "Any"} - ${cls.max_age ?? "Any"}`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Room</dt>
              <dd className="text-charcoal">{cls.room || "-"}</dd>
            </div>
          </dl>
        </div>

        {/* Schedule */}
        <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Schedule
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-mist text-xs">Start Date</dt>
              <dd className="text-charcoal">{cls.start_date || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">End Date</dt>
              <dd className="text-charcoal">{cls.end_date || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Recurrence</dt>
              <dd className="text-charcoal">{scheduleDays || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Time</dt>
              <dd className="text-charcoal">
                {recurrence
                  ? `${formatTime(recurrence.start_time)} - ${formatTime(recurrence.end_time)}`
                  : "-"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Staff & Enrollment */}
        <div className="rounded-xl border border-silver bg-white p-5 space-y-4">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Staff & Enrollment
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-mist text-xs">Lead Teacher</dt>
              <dd className="text-charcoal">{cls.teacherName || "-"}</dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Assistants</dt>
              <dd className="text-charcoal">
                {assistantNames.length > 0 ? assistantNames.join(", ") : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Enrollment</dt>
              <dd className="text-charcoal">
                {cls.enrollment_count}
                {cls.max_enrollment ? ` / ${cls.max_enrollment}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Open Enrollment</dt>
              <dd className="text-charcoal">
                {cls.is_open_enrollment ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Trial Eligible</dt>
              <dd className="text-charcoal">
                {cls.trial_eligible ? "Yes" : "No"}
                {cls.trial_eligible && cls.trial_requires_approval
                  ? " (approval required)"
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-mist text-xs">Max Trials / Session</dt>
              <dd className="text-charcoal">
                {cls.trial_eligible ? cls.trial_max_per_class : "-"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-silver">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Sessions
          </h2>
          <p className="text-xs text-mist mt-0.5">
            Individual class meetings generated from the recurrence schedule.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver bg-cloud/50">
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Time
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Room
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/50">
              {(!sessions || sessions.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-mist"
                  >
                    No sessions generated yet. Sessions are created when the
                    class is set to active with a recurrence schedule.
                  </td>
                </tr>
              )}
              {(sessions ?? []).map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-cloud/30 transition-colors"
                >
                  <td className="px-4 py-3 text-charcoal">{s.session_date}</td>
                  <td className="px-4 py-3 text-slate">
                    {formatTime(s.start_time)} - {formatTime(s.end_time)}
                  </td>
                  <td className="px-4 py-3 text-slate">{s.room || "-"}</td>
                  <td className="px-4 py-3">
                    {s.is_cancelled ? (
                      <span className="inline-block rounded-full bg-[#C45B5B]/10 text-[#C45B5B] px-2.5 py-0.5 text-xs font-medium">
                        Cancelled
                      </span>
                    ) : s.needs_coverage ? (
                      <span className="inline-block rounded-full bg-[#D4A843]/10 text-[#D4A843] px-2.5 py-0.5 text-xs font-medium">
                        Needs Coverage
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-[#5A9E6F]/10 text-[#5A9E6F] px-2.5 py-0.5 text-xs font-medium capitalize">
                        {s.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enrolled Students */}
      <EnrolledStudents
        classId={id}
        enrollments={classEnrollments as never[]}
        maxEnrollment={cls.max_enrollment}
      />
    </div>
  );
}
