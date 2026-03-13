import { requireParent } from "@/lib/auth/guards";
import { getMyStudents, getMyEnrollments, getMyStudentBadges } from "@/lib/queries/portal";
import { getStudioSettings } from "@/lib/queries/studio-settings";
import { ClassCard } from "@/components/bam/ClassCard";
import { DancerCard } from "@/components/bam/DancerCard";
import { BadgeDisplay } from "@/components/bam/BadgeDisplay";
import { EmptyState } from "@/components/bam/empty-state";

export default async function DashboardPage() {
  const user = await requireParent();
  const [students, enrollments, badges, settings] = await Promise.all([
    getMyStudents(),
    getMyEnrollments(),
    getMyStudentBadges(),
    getStudioSettings(),
  ]);
  const studioName = settings?.studio_name ?? "Ballet Academy & Movement";

  const hasStudents = students.length > 0;
  const hasEnrollments = enrollments.length > 0;

  // Count enrollments and badges per student
  const enrollmentCounts: Record<string, number> = {};
  for (const e of enrollments) {
    enrollmentCounts[e.student_id] = (enrollmentCounts[e.student_id] ?? 0) + 1;
  }
  const badgeCounts: Record<string, number> = {};
  for (const b of badges) {
    badgeCounts[b.student_id] = (badgeCounts[b.student_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Welcome back{user.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate">
          Here&apos;s what&apos;s happening at {studioName}.
        </p>
      </div>

      {/* No students yet — onboarding */}
      {!hasStudents && (
        <EmptyState
          icon="♡"
          title="Add your first dancer"
          description="Get started by adding your child's profile. You'll be able to browse classes and enroll from there."
          actionLabel="+ Add a Dancer"
          actionHref="/portal/children"
        />
      )}

      {/* My Dancers (quick view) */}
      {hasStudents && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              My Dancers
            </h2>
            <a
              href="/portal/children"
              className="text-sm text-lavender hover:text-lavender-dark font-medium"
            >
              View all
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {students.slice(0, 4).map((student) => (
              <DancerCard
                key={student.id}
                student={student}
                enrollmentCount={enrollmentCounts[student.id] ?? 0}
                badgeCount={badgeCounts[student.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Classes */}
      {hasStudents && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            Enrolled Classes
          </h2>
          {hasEnrollments ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {enrollments.map((enrollment) => {
                const studentRaw = enrollment.students as unknown;
                const student = (
                  Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
                ) as {
                  id: string;
                  first_name: string;
                  last_name: string;
                } | null;
                const classRaw = enrollment.classes as unknown;
                const classData = (
                  Array.isArray(classRaw) ? classRaw[0] : classRaw
                ) as {
                  id: string;
                  name: string;
                  style: string;
                  level: string;
                  day_of_week: number | null;
                  start_time: string | null;
                  end_time: string | null;
                  room: string | null;
                } | null;

                if (!classData) return null;

                return (
                  <ClassCard
                    key={enrollment.id}
                    classData={classData}
                    studentName={
                      student
                        ? `${student.first_name} ${student.last_name}`
                        : undefined
                    }
                    status={enrollment.status}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="▦"
              title="No classes yet"
              description="Browse our class catalog to find the right fit for your dancer."
              actionLabel="Browse Classes"
              actionHref="/portal/schedule"
            />
          )}
        </section>
      )}

      {/* Recent Badges */}
      {badges.length > 0 && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            Recent Achievements
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {badges.slice(0, 4).map((sb) => {
              const badgeRaw = sb.badges as unknown;
              const badge = (
                Array.isArray(badgeRaw) ? badgeRaw[0] : badgeRaw
              ) as {
                name: string;
                description: string | null;
                category: string;
                tier: string;
              } | null;
              const studentRaw = sb.students as unknown;
              const student = (
                Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
              ) as {
                first_name: string;
                last_name: string;
              } | null;

              if (!badge) return null;

              return (
                <BadgeDisplay
                  key={sb.id}
                  badge={badge}
                  studentName={
                    student
                      ? `${student.first_name} ${student.last_name}`
                      : undefined
                  }
                  awardedAt={sb.awarded_at}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      {hasStudents && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              href="/portal/schedule"
              icon="▦"
              label="View Schedule"
            />
            <QuickAction
              href="/portal/billing"
              icon="✦"
              label="Pay Tuition"
            />
            <QuickAction
              href="/portal/performances"
              icon="★"
              label="Performances"
            />
            <QuickAction
              href="/portal/messages"
              icon="✉"
              label="Messages"
            />
          </div>
        </section>
      )}

      {/* Studio contact */}
      <section className="rounded-xl border border-silver bg-white p-5">
        <h3 className="font-heading text-base font-semibold text-charcoal">
          Need Help?
        </h3>
        <p className="mt-1 text-sm text-slate">
          Reach the studio at{" "}
          <a
            href="tel:+19492290846"
            className="text-lavender hover:text-lavender-dark font-medium"
          >
            (949) 229-0846
          </a>{" "}
          or{" "}
          <a
            href="mailto:dance@bamsocal.com"
            className="text-lavender hover:text-lavender-dark font-medium"
          >
            dance@bamsocal.com
          </a>
        </p>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-silver bg-white p-4 text-center hover:border-lavender hover:shadow-sm transition-all"
    >
      <span className="text-xl text-lavender">{icon}</span>
      <span className="text-xs font-medium text-charcoal">{label}</span>
    </a>
  );
}
