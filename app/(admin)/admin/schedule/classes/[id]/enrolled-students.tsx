"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDropStudent } from "@/app/(admin)/admin/families/actions";
import { EnrollModal } from "./enroll-modal";

interface EnrollmentRow {
  id: string;
  status: string;
  enrollment_type: string;
  enrolled_at: string;
  student_id: string;
  family_id: string | null;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    family_id: string | null;
  } | null;
  families: { id: string; family_name: string } | null;
}

interface EnrolledStudentsProps {
  classId: string;
  enrollments: EnrollmentRow[];
  maxEnrollment: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlist: "bg-[#D4A843]/10 text-[#D4A843]",
  pending_payment: "bg-[#D4A843]/10 text-[#D4A843]",
};

export function EnrolledStudents({
  classId,
  enrollments,
  maxEnrollment,
}: EnrolledStudentsProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [dropping, setDropping] = useState<string | null>(null);

  async function handleDrop(enrollmentId: string) {
    if (!confirm("Are you sure you want to drop this student?")) return;
    setDropping(enrollmentId);
    const fd = new FormData();
    fd.set("enrollment_id", enrollmentId);
    fd.set("drop_reason", "Admin removed");
    await adminDropStudent(fd);
    setDropping(null);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-silver bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-silver flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Enrolled Students
          </h2>
          <p className="text-xs text-mist mt-0.5">
            {enrollments.length}
            {maxEnrollment ? ` / ${maxEnrollment}` : ""} enrolled
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 transition-colors"
        >
          + Enroll Student
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver bg-cloud/50">
              <th className="text-left px-4 py-3 font-medium text-slate">
                Student
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Family
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Type
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate">
                Enrolled
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silver/50">
            {enrollments.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-mist"
                >
                  No students enrolled yet.
                </td>
              </tr>
            )}
            {enrollments.map((e) => {
              const student = (
                Array.isArray(e.students) ? e.students[0] : e.students
              ) as {
                first_name: string;
                last_name: string;
              } | null;
              const family = (
                Array.isArray(e.families) ? e.families[0] : e.families
              ) as { family_name: string } | null;

              return (
                <tr
                  key={e.id}
                  className="hover:bg-cloud/30 transition-colors"
                >
                  <td className="px-4 py-3 text-charcoal font-medium">
                    {student
                      ? `${student.first_name} ${student.last_name}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {family?.family_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate capitalize">
                    {e.enrollment_type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        STATUS_COLORS[e.status] ?? "bg-cloud text-slate"
                      }`}
                    >
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {e.enrolled_at
                      ? new Date(e.enrolled_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDrop(e.id)}
                      disabled={dropping === e.id}
                      className="text-xs text-[#C45B5B] hover:text-[#C45B5B]/80 font-medium disabled:opacity-50"
                    >
                      {dropping === e.id ? "Dropping..." : "Drop"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <EnrollModal
          classId={classId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
