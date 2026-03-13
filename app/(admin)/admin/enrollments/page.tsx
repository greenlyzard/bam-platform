import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EnrollmentsTable } from "./enrollments-table";

export const metadata = {
  title: "Enrollments — Admin",
  description: "Manage student enrollments and payment tracking.",
};

export default async function EnrollmentsPage() {
  await requireAdmin();

  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      status,
      enrollment_type,
      enrolled_at,
      amount_paid_cents,
      stripe_payment_intent_id,
      student:students(id, first_name, last_name),
      class:classes(id, name, day_of_week, start_time),
      family:families(id, family_name)
    `)
    .order("enrolled_at", { ascending: false })
    .limit(200);

  const rows = (enrollments ?? []).map((e) => {
    const student = e.student as unknown as { id: string; first_name: string; last_name: string } | null;
    const cls = e.class as unknown as { id: string; name: string; day_of_week: number; start_time: string } | null;

    return {
      id: e.id as string,
      studentName: student ? `${student.first_name} ${student.last_name}` : "N/A",
      studentId: student?.id ?? null,
      className: cls?.name ?? "N/A",
      classId: cls?.id ?? null,
      enrolledAt: e.enrolled_at as string | null,
      enrollmentType: e.enrollment_type as string,
      status: e.status as string,
      amountPaidCents: e.amount_paid_cents as number | null,
      hasStripePayment: !!(e.stripe_payment_intent_id),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Enrollments
        </h1>
        <p className="mt-1 text-sm text-slate">
          View and manage student enrollments across all classes.
        </p>
      </div>
      <EnrollmentsTable enrollments={rows} />
    </div>
  );
}
