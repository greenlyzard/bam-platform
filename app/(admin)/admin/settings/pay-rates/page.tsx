import { requireRole } from "@/lib/auth/guards";
import { getAllTeachers } from "@/lib/queries/admin";
import { PayRateEditor } from "./pay-rate-editor";

export default async function PayRatesPage() {
  await requireRole("finance_admin", "admin", "super_admin");

  const teachers = await getAllTeachers();

  const mapped = teachers.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email,
    classRateCents: t.class_rate_cents,
    privateRateCents: t.private_rate_cents,
    rehearsalRateCents: t.rehearsal_rate_cents,
    adminRateCents: t.admin_rate_cents,
  }));

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/admin/settings/theme"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Settings
        </a>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Pay Rates
        </h1>
        <p className="mt-1 text-sm text-slate">
          Set hourly pay rates per teacher and class type. Changes take effect
          immediately for new timesheet entries.
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No teachers found. Add teachers first.
        </div>
      ) : (
        <PayRateEditor teachers={mapped} />
      )}
    </div>
  );
}
