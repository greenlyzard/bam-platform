import { requireParent } from "@/lib/auth/guards";
import { getMyStudents, getMyEnrollments, getMyStudentBadges, getMyFamily } from "@/lib/queries/portal";
import { getStudioSettings } from "@/lib/queries/studio-settings";
import { createClient } from "@/lib/supabase/server";
import { ClassCard } from "@/components/bam/ClassCard";
import { DancerCard } from "@/components/bam/DancerCard";
import { BadgeDisplay } from "@/components/bam/BadgeDisplay";
import { EmptyState } from "@/components/bam/empty-state";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireParent();
  const [students, enrollments, badges, settings, family] = await Promise.all([
    getMyStudents(),
    getMyEnrollments(),
    getMyStudentBadges(),
    getStudioSettings(),
    getMyFamily(),
  ]);
  const studioName = settings?.studio_name ?? "Ballet Academy & Movement";

  const hasStudents = students.length > 0;
  const hasEnrollments = enrollments.length > 0;

  // Detect if user is an adult student (self-enrolled, age 18+)
  const isSelfStudent = students.length === 1 && students[0].parent_id === user.id && (() => {
    const dob = students[0].date_of_birth;
    if (!dob) return false;
    const birth = new Date(dob + "T12:00:00");
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 16;
  })();

  // Check if family has active booking approvals for private self-booking
  let canBookPrivate = false;
  try {
    if (family?.id) {
      const supabase = await createClient();
      const { count } = await supabase
        .from("teacher_booking_approvals")
        .select("id", { count: "exact", head: true })
        .eq("family_id", family.id)
        .eq("is_active", true);
      canBookPrivate = (count ?? 0) > 0;
    }
  } catch {
    // table may not exist — skip gracefully
  }

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
        {canBookPrivate && (
          <Link
            href="/portal/book-private"
            className="inline-flex items-center gap-1.5 mt-3 h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 transition-colors"
          >
            Book a Private
          </Link>
        )}
        <Link
          href="/portal/enroll"
          className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-lavender text-lavender hover:bg-lavender/5 text-sm font-semibold px-4 transition-colors mt-3 ml-2"
        >
          + Add a Class
        </Link>
      </div>

      {/* Re-Enrollment Banner — show seasonally */}
      {hasStudents && (
        <div className="rounded-xl border border-lavender/20 bg-lavender/5 p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-charcoal">Secure your spot for next season!</p>
            <p className="text-xs text-slate mt-0.5">Re-enrollment is now open. Keep your dancer&apos;s schedule.</p>
          </div>
          <Link href="/portal/enroll" className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 transition-colors inline-flex items-center">
            Re-Enroll Now
          </Link>
        </div>
      )}

      {/* No students yet — onboarding */}
      {!hasStudents && (
        <EmptyState
          icon="♡"
          title="Get started"
          description="Add a dancer profile to browse classes and enroll."
          actionLabel="+ Add a Dancer"
          actionHref="/portal/children"
        />
      )}

      {/* My Dancers / My Profile (quick view) */}
      {hasStudents && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              {isSelfStudent ? "My Classes" : "My Dancers"}
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
              <div key={student.id} className="flex flex-col gap-1">
                <DancerCard
                  student={student}
                  enrollmentCount={enrollmentCounts[student.id] ?? 0}
                  badgeCount={badgeCounts[student.id] ?? 0}
                />
                <Link href={`/portal/enroll?student=${student.id}`} className="text-xs text-lavender hover:text-lavender-dark">
                  + Enroll in Another Class
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Classes */}
      {hasStudents && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            {isSelfStudent ? "Your Classes" : "Enrolled Classes"}
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

      {/* Family Account Balance */}
      {family && Number(family.account_credit) > 0 && (
        <section className="rounded-xl border border-silver bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Account Credit
              </h3>
              <p className="text-sm text-slate mt-0.5">
                {family.family_name}
              </p>
            </div>
            <p className="text-xl font-semibold text-[#5A9E6F]">
              ${Number(family.account_credit).toFixed(2)}
            </p>
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
