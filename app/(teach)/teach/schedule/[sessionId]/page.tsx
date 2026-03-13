import { requireRole } from "@/lib/auth/guards";
import { getSessionById, CLASS_TYPE_COLORS } from "@/lib/schedule/queries";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CheckinForm } from "./checkin-form";
import { AbsentButton } from "./absent-button";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRole("teacher", "admin", "super_admin");
  const { sessionId } = await params;

  const session = await getSessionById(sessionId);
  if (!session) notFound();

  const supabase = await createClient();

  // Check if the current user is the teacher for this session
  const isMySession =
    session.lead_teacher_id === user.id ||
    session.substitute_teacher_id === user.id ||
    (session.assistant_teacher_ids ?? []).includes(user.id);

  // Get enrolled students for this class
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, first_name, last_name)")
    .eq("class_id", session.class_id)
    .in("status", ["active", "trial"]);

  const students = (enrollments ?? []).map((e: any) => ({
    id: e.student_id,
    name: [e.students?.first_name, e.students?.last_name]
      .filter(Boolean)
      .join(" "),
  }));

  // Get existing attendance records
  const { data: attendanceData } = await supabase
    .from("session_attendance")
    .select("student_id, status, notes")
    .eq("session_id", sessionId);

  const existingAttendance = (attendanceData ?? []).map((a: any) => ({
    student_id: a.student_id,
    status: a.status,
    notes: a.notes ?? "",
  }));

  // Check for back-to-back class propagation
  // Get the class to see if it has back_to_back_class_ids
  const { data: classData } = await supabase
    .from("classes")
    .select("back_to_back_class_ids")
    .eq("id", session.class_id)
    .single();

  let backToBackStudents: Array<{ student_id: string; fromClassName: string }> =
    [];

  if (
    classData?.back_to_back_class_ids &&
    classData.back_to_back_class_ids.length > 0
  ) {
    // Find sessions from back-to-back classes on the same day that have attendance
    for (const bbClassId of classData.back_to_back_class_ids) {
      const { data: bbSession } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("class_id", bbClassId)
        .eq("session_date", session.session_date)
        .limit(1)
        .single();

      if (bbSession) {
        const { data: bbAttendance } = await supabase
          .from("session_attendance")
          .select("student_id, status")
          .eq("session_id", bbSession.id)
          .eq("status", "present");

        const { data: bbClass } = await supabase
          .from("classes")
          .select("simple_name, full_name, name")
          .eq("id", bbClassId)
          .single();

        const bbClassName =
          bbClass?.simple_name ?? bbClass?.full_name ?? bbClass?.name ?? "";

        for (const att of bbAttendance ?? []) {
          // Only include students who are also enrolled in this class
          if (students.some((s) => s.id === att.student_id)) {
            backToBackStudents.push({
              student_id: att.student_id,
              fromClassName: bbClassName,
            });
          }
        }
      }
    }
  }

  const isLocked = !!session.attendance_locked_at;

  const badgeClasses =
    CLASS_TYPE_COLORS[session.classType ?? "regular"] ?? "bg-cloud text-slate";

  const statusLabels: Record<string, { label: string; classes: string }> = {
    scheduled: { label: "Scheduled", classes: "bg-info/10 text-info" },
    in_progress: {
      label: "In Progress",
      classes: "bg-lavender/10 text-lavender-dark",
    },
    completed: { label: "Completed", classes: "bg-success/10 text-success" },
    cancelled: { label: "Cancelled", classes: "bg-error/10 text-error" },
  };
  const sessionStatus = statusLabels[session.status] ??
    statusLabels.scheduled ?? { label: session.status, classes: "bg-cloud text-slate" };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <a
        href="/teach/schedule"
        className="inline-flex items-center text-sm text-slate hover:text-charcoal transition-colors"
      >
        &larr; Back to schedule
      </a>

      {/* Session header */}
      <div className="rounded-xl border border-silver bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}
              >
                {(session.classType ?? "regular").replace(/_/g, " ")}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sessionStatus.classes}`}
              >
                {sessionStatus.label}
              </span>
              {session.is_cancelled && (
                <span className="inline-flex items-center rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                  Cancelled
                </span>
              )}
              {isLocked && (
                <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  Attendance Locked
                </span>
              )}
            </div>
            <h1 className="text-2xl font-heading font-semibold text-charcoal">
              {session.className ?? "Untitled Session"}
            </h1>
            <p className="text-sm text-slate mt-1">
              {formatDate(session.session_date)}
            </p>
            <p className="text-sm text-slate">
              {formatTime(session.start_time)} &ndash;{" "}
              {formatTime(session.end_time)}
              {session.room && (
                <span className="text-mist"> &middot; {session.room}</span>
              )}
            </p>
            {session.teacherName && (
              <p className="text-sm text-mist mt-1">
                {session.subTeacherName
                  ? `Sub: ${session.subTeacherName} (for ${session.teacherName})`
                  : `Teacher: ${session.teacherName}`}
              </p>
            )}
            <p className="text-sm text-mist mt-0.5">
              {students.length} student{students.length !== 1 ? "s" : ""}{" "}
              enrolled
            </p>
          </div>

          {/* Mark Me Absent button — only show for lead teacher, not already cancelled */}
          {isMySession &&
            session.lead_teacher_id === user.id &&
            !session.is_cancelled &&
            !session.needs_coverage && (
              <AbsentButton sessionId={session.id} />
            )}
        </div>

        {session.needs_coverage && (
          <div className="mt-4 rounded-lg bg-warning/10 border border-warning/20 px-4 py-3">
            <p className="text-sm font-medium text-warning">
              This session needs substitute coverage. Admin has been notified.
            </p>
          </div>
        )}

        {session.cancellation_reason && (
          <div className="mt-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3">
            <p className="text-sm text-error">
              <span className="font-medium">Cancellation reason:</span>{" "}
              {session.cancellation_reason}
            </p>
          </div>
        )}

        {session.session_notes && (
          <div className="mt-4 rounded-lg bg-cloud px-4 py-3">
            <p className="text-sm text-slate">
              <span className="font-medium text-charcoal">Notes:</span>{" "}
              {session.session_notes}
            </p>
          </div>
        )}
      </div>

      {/* Check-In Section */}
      {!session.is_cancelled && (
        <div className="rounded-xl border border-silver bg-white p-5">
          <CheckinForm
            sessionId={session.id}
            sessionDate={session.session_date}
            students={students}
            existingAttendance={existingAttendance}
            isLocked={isLocked}
            backToBackStudents={backToBackStudents}
          />
        </div>
      )}
    </div>
  );
}
