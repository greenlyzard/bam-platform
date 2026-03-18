import { requireAdmin } from "@/lib/auth/guards";
import { getStudents } from "@/lib/queries/students";
import Link from "next/link";
import { StudentFilters } from "./student-filters";

export const metadata = { title: "Students — Admin" };

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; consent?: string }>;
}) {
  await requireAdmin();
  const { q, consent } = await searchParams;
  const students = await getStudents({
    search: q,
    mediaConsent: (consent as "yes" | "no" | "") || "",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Students
          </h1>
          <p className="mt-1 text-sm text-slate">
            {students.length} {students.length === 1 ? "student" : "students"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <StudentFilters />

      {/* Table */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver bg-cloud/50">
                <th className="text-left px-4 py-3 font-medium text-slate w-10" />
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Name
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate">
                  Age
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Level
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate">
                  Classes
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate">
                  Media Consent
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/50">
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-mist"
                  >
                    {q || consent
                      ? "No students match your filters."
                      : "No students found."}
                  </td>
                </tr>
              )}
              {students.map((s) => {
                const age = calculateAge(s.date_of_birth);
                const displayName = s.preferred_name && s.preferred_name !== s.first_name
                  ? `${s.preferred_name} (${s.first_name}) ${s.last_name}`
                  : `${s.first_name} ${s.last_name}`;

                return (
                  <tr
                    key={s.id}
                    className="hover:bg-cloud/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-cloud flex items-center justify-center overflow-hidden border border-silver">
                        {s.avatar_url ? (
                          <img
                            src={s.avatar_url}
                            alt={s.first_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium text-lavender">
                            {s.first_name[0]}
                            {s.last_name[0]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="font-medium text-charcoal hover:text-lavender transition-colors"
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-slate">
                      {age}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {s.current_level ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate">
                      {(s as { enrollment_count?: number }).enrollment_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.media_consent
                            ? "bg-[#5A9E6F]/10 text-[#5A9E6F]"
                            : "bg-[#C45B5B]/10 text-[#C45B5B]"
                        }`}
                      >
                        {s.media_consent ? "Consented" : "Missing"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.active
                            ? "bg-[#5A9E6F]/10 text-[#5A9E6F]"
                            : "bg-[#9E99A7]/10 text-[#9E99A7]"
                        }`}
                      >
                        {s.active ? "Active" : "Inactive"}
                      </span>
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
