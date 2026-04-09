import { requireAdmin } from "@/lib/auth/guards";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import {
  getStudentById,
  getStudentEnrollments,
  getStudentSchedule,
  getStudentGuardians,
  getStudentExtendedContacts,
} from "@/lib/queries/students";
import { StudentDetail } from "./student-detail";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudentById(id);
  return {
    title: student
      ? `${student.preferred_name || student.first_name} ${student.last_name} — Students`
      : "Student Detail",
  };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [student, enrollments, schedule, guardians, extendedContacts] =
    await Promise.all([
      getStudentById(id),
      getStudentEnrollments(id),
      getStudentSchedule(id, 0),
      getStudentGuardians(id),
      getStudentExtendedContacts(id),
    ]);

  if (!student) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/students"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Students
        </Link>
      </div>

      <StudentDetail
        student={student}
        enrollments={enrollments}
        schedule={schedule}
        guardians={guardians}
        extendedContacts={extendedContacts}
      />
    </div>
  );
}
