import { requireAdmin } from "@/lib/auth/guards";
import { getFamilies } from "@/lib/queries/families";
import Link from "next/link";

export const metadata = { title: "Families — Admin" };

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const families = await getFamilies(q);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Families
          </h1>
          <p className="mt-1 text-sm text-slate">
            {families.length} {families.length === 1 ? "family" : "families"}
          </p>
        </div>
        <Link
          href="/admin/families/new"
          className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 flex items-center transition-colors shrink-0"
        >
          + Add Family
        </Link>
      </div>

      {/* Search */}
      <form className="max-w-md">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by family name or email..."
          className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
        />
      </form>

      {/* Table */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver bg-cloud/50">
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Family Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate">
                  Primary Contact
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate">
                  Students
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate">
                  Monthly Tuition
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate">
                  Media Consent
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/50">
              {families.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-mist"
                  >
                    {q
                      ? "No families match your search."
                      : "No families yet. Add your first family to get started."}
                  </td>
                </tr>
              )}
              {families.map((family) => {
                const profile = family.profiles as unknown as {
                  first_name: string | null;
                  last_name: string | null;
                  email: string | null;
                } | null;
                const contactName = profile
                  ? [profile.first_name, profile.last_name]
                      .filter(Boolean)
                      .join(" ")
                  : "-";
                const f = family as {
                  student_count?: number;
                  all_consented?: boolean;
                  monthly_tuition_cents?: number;
                };

                return (
                  <tr
                    key={family.id}
                    className="hover:bg-cloud/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/families/${family.id}`}
                        className="font-medium text-charcoal hover:text-lavender transition-colors"
                      >
                        {family.family_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate">{contactName}</div>
                      <div className="text-xs text-mist">
                        {family.billing_email || profile?.email || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate">
                      {f.student_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-slate">
                      {(f.monthly_tuition_cents ?? 0) > 0
                        ? `$${((f.monthly_tuition_cents ?? 0) / 100).toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(f.student_count ?? 0) > 0 ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            f.all_consented
                              ? "bg-[#5A9E6F]/10 text-[#5A9E6F]"
                              : "bg-[#C45B5B]/10 text-[#C45B5B]"
                          }`}
                        >
                          {f.all_consented ? "All Clear" : "Missing"}
                        </span>
                      ) : (
                        <span className="text-mist">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate">
                      {family.account_credit > 0
                        ? `$${Number(family.account_credit).toFixed(2)}`
                        : "-"}
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
