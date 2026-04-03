import { requireParent } from "@/lib/auth/guards";
import {
  getMyStudents,
  getMyEnrollments,
  getMyStudentBadges,
  getUpcomingSessionsForStudents,
} from "@/lib/queries/portal";
import { DancerCard } from "@/components/bam/DancerCard";
import { EmptyState } from "@/components/bam/empty-state";
import { AddDancerForm } from "./add-dancer-form";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STYLE_LABELS: Record<string, string> = {
  ballet: "Ballet",
  pre_ballet: "Pre-Ballet",
  creative_movement: "Creative Movement",
  pointe: "Pointe",
  jazz: "Jazz",
  contemporary: "Contemporary",
  lyrical: "Lyrical",
  musical_theatre: "Musical Theatre",
  hip_hop: "Hip Hop",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function ChildrenPage() {
  await requireParent();
  const [students, enrollments, badges] = await Promise.all([
    getMyStudents(),
    getMyEnrollments(),
    getMyStudentBadges(),
  ]);

  const studentIds = students.map((s) => s.id);
  const upcomingSessions = await getUpcomingSessionsForStudents(studentIds);

  // Count per student
  const enrollmentCounts: Record<string, number> = {};
  for (const e of enrollments) {
    enrollmentCounts[e.student_id] = (enrollmentCounts[e.student_id] ?? 0) + 1;
  }
  const badgeCounts: Record<string, number> = {};
  for (const b of badges) {
    badgeCounts[b.student_id] = (badgeCounts[b.student_id] ?? 0) + 1;
  }

  // Group enrollments by student
  const enrollmentsByStudent: Record<string, typeof enrollments> = {};
  for (const e of enrollments) {
    if (!enrollmentsByStudent[e.student_id]) enrollmentsByStudent[e.student_id] = [];
    enrollmentsByStudent[e.student_id].push(e);
  }

  // Group upcoming sessions by student (limit 3 per student)
  const sessionsByStudent: Record<string, typeof upcomingSessions> = {};
  for (const s of upcomingSessions) {
    for (const studentId of s.studentIds) {
      if (!sessionsByStudent[studentId]) sessionsByStudent[studentId] = [];
      if (sessionsByStudent[studentId].length < 3) {
        sessionsByStudent[studentId].push(s);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            My Students
          </h1>
          <p className="mt-1 text-sm text-slate">
            Manage profiles and enrollments.
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon="♡"
          title="No students yet"
          description="Add a student to start browsing classes and tracking progress."
        />
      ) : (
        <div className="space-y-6">
          {students.map((student) => {
            const studentEnrollments = enrollmentsByStudent[student.id] ?? [];
            const studentSessions = sessionsByStudent[student.id] ?? [];

            return (
              <div key={student.id} className="space-y-3">
                <DancerCard
                  student={student}
                  enrollmentCount={enrollmentCounts[student.id] ?? 0}
                  badgeCount={badgeCounts[student.id] ?? 0}
                />

                {/* Enrolled Classes */}
                {studentEnrollments.length > 0 && (
                  <div className="ml-4 rounded-xl border border-silver bg-white p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-slate uppercase tracking-wide">
                      Enrolled Classes
                    </h4>
                    <div className="space-y-2">
                      {studentEnrollments.map((enrollment) => {
                        const cls = (
                          Array.isArray(enrollment.classes)
                            ? enrollment.classes[0]
                            : enrollment.classes
                        ) as {
                          id: string;
                          name: string;
                          style: string;
                          level: string;
                          day_of_week: number;
                          start_time: string;
                          end_time: string;
                          room: string | null;
                          teacher_id: string | null;
                        } | null;

                        if (!cls) return null;

                        return (
                          <div
                            key={enrollment.id}
                            className="flex items-center justify-between rounded-lg bg-cloud px-3 py-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-charcoal truncate">
                                  {cls.name}
                                </p>
                                <p className="text-xs text-mist">
                                  {DAYS[cls.day_of_week]} {formatTime(cls.start_time)} –{" "}
                                  {formatTime(cls.end_time)}
                                  {cls.room && ` · ${cls.room}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="inline-block rounded-full bg-lavender/10 text-lavender-dark px-2 py-0.5 text-xs font-medium">
                                {STYLE_LABELS[cls.style] ?? cls.style}
                              </span>
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                  enrollment.status === "trial"
                                    ? "bg-gold-light text-gold-dark"
                                    : "bg-success/10 text-success"
                                }`}
                              >
                                {enrollment.status === "trial" ? "Trial" : "Active"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upcoming Sessions */}
                {studentSessions.length > 0 && (
                  <div className="ml-4 rounded-xl border border-silver bg-white p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-slate uppercase tracking-wide">
                      Upcoming Sessions
                    </h4>
                    <div className="space-y-2">
                      {studentSessions.map((session) => {
                        const cls = (
                          Array.isArray(session.classes)
                            ? session.classes[0]
                            : session.classes
                        ) as {
                          id: string;
                          name: string;
                          simple_name: string | null;
                          style: string;
                          level: string;
                        } | null;

                        return (
                          <div
                            key={session.id}
                            className="flex items-center justify-between rounded-lg bg-cloud px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-charcoal truncate">
                                {cls?.simple_name || cls?.name || "Class"}
                              </p>
                              <p className="text-xs text-mist">
                                {formatDate(session.session_date)}{" "}
                                {formatTime(session.start_time)} –{" "}
                                {formatTime(session.end_time)}
                                {session.room && ` · ${session.room}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {studentSessions.length === 3 && (
                      <a
                        href={`/portal/students/${student.id}`}
                        className="block text-xs text-lavender hover:text-lavender-dark font-medium"
                      >
                        View all →
                      </a>
                    )}
                  </div>
                )}

                {/* No enrollments message */}
                {studentEnrollments.length === 0 && (
                  <div className="ml-4 rounded-xl border border-dashed border-silver bg-white p-4">
                    <p className="text-sm text-mist">
                      No classes yet.{" "}
                      <a
                        href="/portal/enrollment"
                        className="text-lavender hover:text-lavender-dark font-medium underline"
                      >
                        Browse classes
                      </a>{" "}
                      to enroll {student.first_name}.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add dancer form */}
      <AddDancerForm />
    </div>
  );
}
