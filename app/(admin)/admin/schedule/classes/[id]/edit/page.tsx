import { requireAdmin } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import {
  getScheduleClassById,
  getRecurrenceRules,
  getApprovedTeachers,
  getProductions,
} from "@/lib/schedule/queries";
import { ClassForm } from "../../class-form";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cls = await getScheduleClassById(id);
  return {
    title: cls
      ? `Edit ${cls.simple_name || cls.full_name || cls.name} — Studio Admin`
      : "Edit Class",
  };
}

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [cls, recurrenceRules, teachers, productions] = await Promise.all([
    getScheduleClassById(id),
    getRecurrenceRules(id),
    getApprovedTeachers(),
    getProductions(),
  ]);

  if (!cls) notFound();

  const recurrence = recurrenceRules[0] ?? null;

  const initialData = {
    id: cls.id,
    full_name: cls.full_name ?? cls.name,
    short_name: cls.short_name ?? "",
    simple_name: cls.simple_name ?? "",
    display_name: cls.display_name ?? "",
    short_description: "",
    long_description: "",
    class_type: cls.class_type,
    program_division: cls.program_division ?? "",
    levels: cls.levels ?? [],
    min_age: cls.min_age,
    max_age: cls.max_age,
    start_date: cls.start_date ?? "",
    end_date: cls.end_date ?? "",
    days_of_week: recurrence?.days_of_week ?? [],
    start_time: recurrence?.start_time ?? "",
    end_time: recurrence?.end_time ?? "",
    room: cls.room ?? "",
    lead_teacher_id: cls.lead_teacher_id ?? "",
    assistant_teacher_ids: cls.assistant_teacher_ids ?? [],
    max_enrollment: cls.max_enrollment,
    min_enrollment: cls.min_enrollment,
    is_open_enrollment: cls.is_open_enrollment,
    trial_eligible: cls.trial_eligible,
    trial_requires_approval: cls.trial_requires_approval,
    trial_max_per_class: cls.trial_max_per_class,
    production_id: cls.production_id ?? "",
    status: cls.status,
    is_published: cls.is_published,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/admin/schedule/classes/${id}`}
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Class
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-charcoal">
          Edit Class
        </h1>
        <p className="mt-1 text-sm text-slate">
          {cls.simple_name || cls.full_name || cls.name}
        </p>
      </div>

      <ClassForm
        initialData={initialData}
        teachers={teachers}
        productions={productions}
      />
    </div>
  );
}
