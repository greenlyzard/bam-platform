import { requireAdmin } from "@/lib/auth/guards";
import {
  getScheduleClasses,
  getApprovedTeachers,
  CLASS_TYPE_COLORS,
} from "@/lib/schedule/queries";
import Link from "next/link";
import { FormSelect } from "./form-select";

export const metadata = {
  title: "Classes — Schedule — Studio Admin",
};

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-cloud text-slate",
  active: "bg-[#5A9E6F]/10 text-[#5A9E6F]",
  cancelled: "bg-[#C45B5B]/10 text-[#C45B5B]",
  completed: "bg-[#9E99A7]/10 text-[#9E99A7]",
};

const CLASS_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "regular", label: "Regular" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "performance", label: "Performance" },
  { value: "competition", label: "Competition" },
  { value: "private", label: "Private" },
  { value: "workshop", label: "Workshop" },
  { value: "intensive", label: "Intensive" },
];

const PROGRAM_OPTIONS = [
  { value: "", label: "All Programs" },
  { value: "petites", label: "Petites" },
  { value: "company", label: "Company" },
  { value: "advanced", label: "Advanced" },
  { value: "adult", label: "Adult" },
  { value: "competitive", label: "Competitive" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{
    classType?: string;
    programDivision?: string;
    status?: string;
    teacherId?: string;
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const teachers = await getApprovedTeachers();

  const classes = await getScheduleClasses({
    classType: params.classType || undefined,
    programDivision: params.programDivision || undefined,
    status: params.status || undefined,
    teacherId: params.teacherId || undefined,
  });

  const totalClasses = classes.length;
  const activeClasses = classes.filter((c) => c.status === "active").length;
  const atCapacity = classes.filter(
    (c) => c.max_enrollment && c.enrollment_count >= c.max_enrollment
  ).length;
  const openSpots = classes.reduce((sum, c) => {
    if (c.status === "active" && c.max_enrollment) {
      return sum + Math.max(0, c.max_enrollment - c.enrollment_count);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">
            Classes
          </h1>
          <p className="mt-1 text-sm text-slate">
            Manage all class types, schedules, and enrollment.
          </p>
        </div>
        <Link
          href="/admin/schedule/classes/new"
          className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 flex items-center transition-colors"
        >
          New Class
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            Total Classes
          </p>
          <p className="mt-1 text-2xl font-heading font-semibold text-charcoal">
            {totalClasses}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            Active
          </p>
          <p className="mt-1 text-2xl font-heading font-semibold text-[#5A9E6F]">
            {activeClasses}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            At Capacity
          </p>
          <p className="mt-1 text-2xl font-heading font-semibold text-[#D4A843]">
            {atCapacity}
          </p>
        </div>
        <div className="rounded-xl border border-silver bg-white p-4">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            Open Spots
          </p>
          <p className="mt-1 text-2xl font-heading font-semibold text-charcoal">
            {openSpots}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <FormSelect
          name="classType"
          defaultValue={params.classType ?? ""}
          options={CLASS_TYPE_OPTIONS.filter((o) => o.value !== "")}
          placeholder="All Types"
        />

        <FormSelect
          name="programDivision"
          defaultValue={params.programDivision ?? ""}
          options={PROGRAM_OPTIONS.filter((o) => o.value !== "")}
          placeholder="All Programs"
        />

        <FormSelect
          name="status"
          defaultValue={params.status ?? ""}
          options={STATUS_OPTIONS.filter((o) => o.value !== "")}
          placeholder="All Statuses"
        />

        <FormSelect
          name="teacherId"
          defaultValue={params.teacherId ?? ""}
          options={teachers.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="All Teachers"
        />

        <button
          type="submit"
          className="h-10 rounded-lg bg-charcoal text-white text-sm font-medium px-5 hover:bg-charcoal/90 transition-colors"
        >
          Filter
        </button>

        {(params.classType || params.programDivision || params.status || params.teacherId) && (
          <Link
            href="/admin/schedule/classes"
            className="h-10 rounded-lg border border-silver text-sm font-medium px-4 flex items-center hover:bg-cloud transition-colors text-slate"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver bg-cloud/50">
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Program
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Teacher
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Enrolled
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Dates
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/50">
              {classes.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-mist"
                  >
                    No classes found. Create your first class to get started.
                  </td>
                </tr>
              )}
              {classes.map((cls) => {
                const displayName =
                  cls.simple_name || cls.full_name || cls.name;
                const typeBadge =
                  CLASS_TYPE_COLORS[cls.class_type] ?? CLASS_TYPE_COLORS.regular;
                const statusBadge =
                  STATUS_BADGES[cls.status] ?? STATUS_BADGES.draft;
                const enrollLabel = cls.max_enrollment
                  ? `${cls.enrollment_count}/${cls.max_enrollment}`
                  : `${cls.enrollment_count}`;
                const dateRange = [cls.start_date, cls.end_date]
                  .filter(Boolean)
                  .join(" - ");

                return (
                  <tr
                    key={cls.id}
                    className="hover:bg-cloud/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/schedule/classes/${cls.id}`}
                        className="font-medium text-charcoal hover:text-lavender transition-colors"
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadge}`}
                      >
                        {cls.class_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate capitalize">
                      {cls.program_division ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {cls.teacherName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate">{enrollLabel}</td>
                    <td className="px-4 py-3 text-slate text-xs">
                      {dateRange || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge}`}
                      >
                        {cls.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/schedule/classes/${cls.id}/edit`}
                        className="text-xs text-lavender hover:text-lavender-dark font-medium transition-colors"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
