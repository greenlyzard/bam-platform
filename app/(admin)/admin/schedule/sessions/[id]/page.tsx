import { requireAdmin } from "@/lib/auth/guards";
import { getSessionById } from "@/lib/schedule/queries";
import { CLASS_TYPE_COLORS } from "@/lib/schedule/queries";
import { notFound } from "next/navigation";
import Link from "next/link";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-[#9C8BBF]/15", text: "text-[#6B5A99]", label: "Scheduled" },
  completed: { bg: "bg-[#5A9E6F]/15", text: "text-[#5A9E6F]", label: "Completed" },
  cancelled: { bg: "bg-[#C45B5B]/15", text: "text-[#C45B5B]", label: "Cancelled" },
  rescheduled: { bg: "bg-[#D4A843]/15", text: "text-[#D4A843]", label: "Rescheduled" },
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) {
    notFound();
  }

  const s = session;
  const statusStyle = STATUS_STYLES[s.status] ?? STATUS_STYLES.scheduled;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-[#9E99A7]">
          <Link href="/admin/schedule" className="hover:text-[#6B5A99] transition-colors">
            Schedule
          </Link>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[#2D2A33]">Session Details</span>
        </nav>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-[#2D2A33]">
              {s.className ?? "Untitled Session"}
            </h1>
            <p className="mt-1 text-sm text-[#5A5662]">{formatFullDate(s.session_date)}</p>
          </div>
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* Main Details Card */}
        <div className="rounded-xl border border-[#D4D1D8] bg-white p-5 mb-5">
          <h2 className="font-heading text-lg font-semibold text-[#2D2A33] mb-4">Session Information</h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Time */}
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Time</div>
              <div className="mt-1 text-sm font-medium text-[#2D2A33]">
                {formatTime(s.start_time)} - {formatTime(s.end_time)}
              </div>
              {s.duration_minutes && (
                <div className="mt-0.5 text-xs text-[#9E99A7]">{s.duration_minutes} minutes</div>
              )}
            </div>

            {/* Room */}
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Room</div>
              <div className="mt-1 text-sm font-medium text-[#2D2A33]">{s.room ?? "Not assigned"}</div>
            </div>

            {/* Date */}
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Date</div>
              <div className="mt-1 text-sm font-medium text-[#2D2A33]">{formatFullDate(s.session_date)}</div>
            </div>

            {/* Class Type */}
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Class Type</div>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                    CLASS_TYPE_COLORS[s.classType ?? "regular"] ?? CLASS_TYPE_COLORS.regular
                  }`}
                >
                  {(s.classType ?? "regular").charAt(0).toUpperCase() + (s.classType ?? "regular").slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Teacher Card */}
        <div className="rounded-xl border border-[#D4D1D8] bg-white p-5 mb-5">
          <h2 className="font-heading text-lg font-semibold text-[#2D2A33] mb-4">Teacher</h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Lead Teacher</div>
              <div className="mt-1 flex items-center gap-2">
                {s.teacherInitials && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9C8BBF]/15 text-xs font-semibold text-[#6B5A99]">
                    {s.teacherInitials}
                  </span>
                )}
                <span className="text-sm font-medium text-[#2D2A33]">
                  {s.teacherName ?? "Not assigned"}
                </span>
              </div>
            </div>

            {s.is_substitute_session && (
              <div>
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Substitute</div>
                <div className="mt-1 text-sm font-medium text-[#D4A843]">
                  {s.subTeacherName ?? "Pending"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-5 sm:grid-cols-4">
          <div className="rounded-xl border border-[#D4D1D8] bg-white p-4 text-center">
            <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Enrolled</div>
            <div className="mt-1 text-2xl font-semibold text-[#2D2A33]">{s.enrollmentCount ?? 0}</div>
          </div>

          <div className="rounded-xl border border-[#D4D1D8] bg-white p-4 text-center">
            <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Status</div>
            <div className="mt-2">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
              >
                {statusStyle.label}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#D4D1D8] bg-white p-4 text-center">
            <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Coverage</div>
            <div className="mt-2">
              {s.needs_coverage ? (
                <span className="inline-block rounded-full bg-[#D4A843]/15 px-2.5 py-1 text-xs font-medium text-[#9B7A2E]">
                  Needed
                </span>
              ) : (
                <span className="inline-block rounded-full bg-[#5A9E6F]/15 px-2.5 py-1 text-xs font-medium text-[#5A9E6F]">
                  Covered
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#D4D1D8] bg-white p-4 text-center">
            <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Attendance</div>
            <div className="mt-2">
              {s.attendance_locked_at ? (
                <span className="inline-block rounded-full bg-[#5A9E6F]/15 px-2.5 py-1 text-xs font-medium text-[#5A9E6F]">
                  Submitted
                </span>
              ) : (
                <span className="inline-block rounded-full bg-[#F0EDF3] px-2.5 py-1 text-xs font-medium text-[#9E99A7]">
                  Pending
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Session Notes */}
        {s.session_notes && (
          <div className="rounded-xl border border-[#D4D1D8] bg-white p-5 mb-5">
            <h2 className="font-heading text-lg font-semibold text-[#2D2A33] mb-3">Session Notes</h2>
            <p className="text-sm text-[#5A5662] whitespace-pre-wrap">{s.session_notes}</p>
          </div>
        )}

        {/* Cancellation Info */}
        {s.is_cancelled && (
          <div className="rounded-xl border border-[#C45B5B]/30 bg-[#C45B5B]/5 p-5 mb-5">
            <h2 className="font-heading text-lg font-semibold text-[#C45B5B] mb-3">Cancellation Details</h2>
            {s.cancellation_reason && (
              <div className="mb-3">
                <div className="text-xs font-medium text-[#C45B5B] uppercase tracking-wide">Reason</div>
                <p className="mt-1 text-sm text-[#5A5662]">{s.cancellation_reason}</p>
              </div>
            )}
          </div>
        )}

        {/* IDs / Meta (collapsed) */}
        <details className="rounded-xl border border-[#D4D1D8] bg-white p-5 mb-5">
          <summary className="cursor-pointer font-heading text-sm font-semibold text-[#9E99A7] hover:text-[#5A5662] transition-colors">
            Technical Details
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Session ID</div>
              <div className="mt-1 text-xs text-[#5A5662] font-mono break-all">{s.id}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Class ID</div>
              <div className="mt-1 text-xs text-[#5A5662] font-mono break-all">{s.class_id}</div>
            </div>
            {s.lead_teacher_id && (
              <div>
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Teacher ID</div>
                <div className="mt-1 text-xs text-[#5A5662] font-mono break-all">{s.lead_teacher_id}</div>
              </div>
            )}
            {s.substitute_teacher_id && (
              <div>
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Substitute ID</div>
                <div className="mt-1 text-xs text-[#5A5662] font-mono break-all">{s.substitute_teacher_id}</div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Tenant ID</div>
              <div className="mt-1 text-xs text-[#5A5662] font-mono break-all">{s.tenant_id}</div>
            </div>
            {s.attendance_locked_at && (
              <div>
                <div className="text-xs font-medium text-[#9E99A7] uppercase tracking-wide">Attendance Locked</div>
                <div className="mt-1 text-xs text-[#5A5662]">
                  {new Date(s.attendance_locked_at).toLocaleString("en-US")}
                </div>
              </div>
            )}
          </div>
        </details>

        {/* Back Link */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/schedule"
            className="rounded-lg border border-[#D4D1D8] px-4 py-2.5 text-sm font-medium text-[#5A5662] hover:bg-[#F0EDF3] transition-colors"
          >
            Back to Schedule
          </Link>
          <Link
            href={`/admin/schedule/classes/${s.class_id}`}
            className="rounded-lg bg-[#9C8BBF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6B5A99] transition-colors"
          >
            View Class
          </Link>
        </div>
      </div>
    </div>
  );
}
