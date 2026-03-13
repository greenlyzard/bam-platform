import { requireAdmin } from "@/lib/auth/guards";
import { getAllTeachers } from "@/lib/queries/admin";
import { TeacherList } from "./TeacherList";

export default async function TeachersPage() {
  await requireAdmin();
  const teachers = await getAllTeachers();

  const complianceIssues = teachers.filter(
    (t) =>
      !t.is_mandated_reporter_certified ||
      !t.background_check_complete ||
      !t.w9_on_file
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Teachers
          </h1>
          <p className="mt-1 text-sm text-slate">
            {teachers.length} teachers ·{" "}
            {complianceIssues.length > 0 ? (
              <span className="text-error">
                {complianceIssues.length} compliance issue
                {complianceIssues.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-success">All compliant</span>
            )}
          </p>
        </div>
      </div>

      <TeacherList teachers={teachers} />
    </div>
  );
}
