import { requireParent } from "@/lib/auth/guards";
import { getClassCatalog } from "@/lib/queries/enroll";
import { getMyStudents } from "@/lib/queries/portal";
import { ClassBrowser } from "./class-browser";

export const metadata = { title: "Browse Classes" };

export default async function EnrollmentPage() {
  await requireParent();
  const [classes, students] = await Promise.all([
    getClassCatalog(),
    getMyStudents(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Browse Classes
        </h1>
        <p className="mt-1 text-sm text-slate">
          Find the right class for your dancer and request enrollment or a trial.
        </p>
      </div>

      <ClassBrowser
        classes={classes}
        students={students.map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          date_of_birth: s.date_of_birth,
          trial_used: s.trial_used ?? false,
        }))}
      />
    </div>
  );
}
