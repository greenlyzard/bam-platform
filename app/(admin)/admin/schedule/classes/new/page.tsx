import { requireAdmin } from "@/lib/auth/guards";
import { getApprovedTeachers, getProductions } from "@/lib/schedule/queries";
import { ClassForm } from "../class-form";
import Link from "next/link";

export const metadata = {
  title: "New Class — Schedule — Studio Admin",
};

export default async function NewClassPage() {
  await requireAdmin();

  const [teachers, productions] = await Promise.all([
    getApprovedTeachers(),
    getProductions(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/schedule/classes"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Classes
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-charcoal">
          New Class
        </h1>
        <p className="mt-1 text-sm text-slate">
          Create a new class, rehearsal, workshop, or private lesson.
        </p>
      </div>

      <ClassForm teachers={teachers} productions={productions} />
    </div>
  );
}
