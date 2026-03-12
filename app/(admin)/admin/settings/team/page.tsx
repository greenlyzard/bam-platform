import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { PendingApprovals } from "./pending-approvals";

export default async function TeamMembersPage() {
  await requireRole("super_admin", "admin");
  const supabase = await createClient();

  // Fetch team members (non-parent roles)
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, approval_status, created_at")
    .in("role", ["super_admin", "admin", "studio_admin", "finance_admin", "studio_manager", "teacher", "front_desk"])
    .order("created_at", { ascending: false });

  const pending = (teamMembers ?? []).filter(m => m.approval_status === "pending_approval");
  const active = (teamMembers ?? []).filter(m => m.approval_status === "active");

  // Fetch pending invites
  const { data: invites } = await supabase
    .from("staff_invites")
    .select("id, email, role, first_name, last_name, accepted_at, expires_at, created_at")
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <a
          href="/admin/settings/theme"
          className="text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          &larr; Settings
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Team Members
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage staff accounts, invite new team members, and approve teacher signups.
        </p>
      </div>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <PendingApprovals members={pending} />
      )}

      {/* Invite Form */}
      <InviteForm />

      {/* Pending Invites */}
      {invites && invites.length > 0 && (
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            Pending Invites
          </h2>
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {inv.first_name} {inv.last_name}
                  </p>
                  <p className="text-xs text-slate">{inv.email} · {inv.role.replace(/_/g, " ")}</p>
                </div>
                <span className="text-xs text-mist">
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Team */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Active Team ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
            No active team members yet.
          </div>
        ) : (
          <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
            {active.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-xs text-slate">{m.email}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-lavender/10 px-2.5 py-0.5 text-xs font-medium text-lavender-dark">
                  {m.role.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
