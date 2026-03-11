import { requireParent } from "@/lib/auth/guards";
import { getMyStudents, getMyEnrollments, getMyStudentBadges } from "@/lib/queries/portal";
import { DancerCard } from "@/components/bam/DancerCard";
import { EmptyState } from "@/components/bam/empty-state";
import { AddDancerForm } from "./add-dancer-form";

export default async function ChildrenPage() {
  await requireParent();
  const [students, enrollments, badges] = await Promise.all([
    getMyStudents(),
    getMyEnrollments(),
    getMyStudentBadges(),
  ]);

  // Count per student
  const enrollmentCounts: Record<string, number> = {};
  for (const e of enrollments) {
    enrollmentCounts[e.student_id] = (enrollmentCounts[e.student_id] ?? 0) + 1;
  }
  const badgeCounts: Record<string, number> = {};
  for (const b of badges) {
    badgeCounts[b.student_id] = (badgeCounts[b.student_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            My Dancers
          </h1>
          <p className="mt-1 text-sm text-slate">
            Manage your children&apos;s profiles and enrollments.
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon="♡"
          title="No dancers yet"
          description="Add your child to start browsing classes and tracking their progress."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {students.map((student) => (
            <DancerCard
              key={student.id}
              student={student}
              enrollmentCount={enrollmentCounts[student.id] ?? 0}
              badgeCount={badgeCounts[student.id] ?? 0}
            />
          ))}
        </div>
      )}

      {/* Add dancer form */}
      <AddDancerForm />
    </div>
  );
}
