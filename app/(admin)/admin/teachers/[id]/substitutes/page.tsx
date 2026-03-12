import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TeacherSubstitutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  // Get teacher profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("id", id)
    .single();

  if (!profile) redirect("/admin/teachers");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .single();

  // Get authorized substitutes
  const { data: authorizations } = await supabase
    .from("substitute_authorizations")
    .select("*")
    .eq("teacher_id", id)
    .order("priority_order");

  // Get sub names
  const subIds = (authorizations ?? []).map((a) => a.teacher_id);
  const subNames: Record<string, string> = {};
  if (subIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", subIds);
    for (const p of profiles ?? []) {
      subNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  const empTypeBadge: Record<string, { label: string; classes: string }> = {
    employee: { label: "Employee", classes: "bg-success/10 text-success" },
    full_time: { label: "Full Time", classes: "bg-success/10 text-success" },
    part_time: { label: "Part Time", classes: "bg-info/10 text-info" },
    contract: { label: "Contract", classes: "bg-warning/10 text-warning" },
    contractor_1099: { label: "1099 Contractor", classes: "bg-warning/10 text-warning" },
    pending_classification: { label: "Pending Review", classes: "bg-error/10 text-error" },
  };

  const badge = empTypeBadge[teacher?.employment_type ?? ""] ?? {
    label: teacher?.employment_type ?? "Unknown",
    classes: "bg-cloud text-slate",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          {profile.first_name} {profile.last_name} — Substitutes
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage substitute teacher authorizations
        </p>
      </div>

      {/* Employment Classification */}
      <div className="rounded-xl border border-silver bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal">
              Employment Classification
            </p>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate">Substitute Sessions</p>
            <p className="text-lg font-heading font-semibold text-charcoal">
              {teacher?.substitute_session_count ?? 0} /{" "}
              {teacher?.substitute_session_threshold ?? 3}
            </p>
          </div>
        </div>
      </div>

      {/* Authorized Substitutes */}
      <div>
        <h2 className="text-base font-heading font-semibold text-charcoal mb-3">
          Pre-Authorized Substitutes
        </h2>
        {authorizations && authorizations.length > 0 ? (
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {authorizations.map((auth, idx) => (
              <div key={auth.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-charcoal">
                      #{idx + 1} — {subNames[auth.teacher_id] ?? "Unknown"}
                    </p>
                    <p className="text-xs text-mist mt-0.5">
                      Levels: {auth.authorized_for_levels?.join(", ") ?? "All"}{" "}
                      &middot; Types:{" "}
                      {auth.authorized_for_types?.join(", ") ?? "All"}
                    </p>
                    {auth.notes && (
                      <p className="text-xs text-slate mt-0.5">{auth.notes}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${auth.is_active ? "text-success" : "text-mist"}`}
                  >
                    {auth.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-8 text-center">
            <p className="text-sm text-mist">
              No substitute authorizations configured
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
