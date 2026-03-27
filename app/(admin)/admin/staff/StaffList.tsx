"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  title: string | null;
  bioShort: string | null;
  roles: string[];
  isActive: boolean;
  classCount: number;
  disciplines: { name: string; iconUrl: string | null }[];
  compliance: { mandated: boolean; background: boolean; w9: boolean };
}

const ROLE_BADGES: Record<string, string> = {
  teacher: "bg-lavender/10 text-lavender-dark",
  admin: "bg-info/10 text-info",
  super_admin: "bg-gold/10 text-gold-dark",
};

function getRoleLabel(roles: string[]): string {
  if (roles.includes("super_admin")) return "Studio Owner";
  if (roles.includes("admin") && roles.includes("teacher")) return "Admin + Teacher";
  if (roles.includes("admin")) return "Admin";
  return "Teacher";
}

function getRoleBadgeClass(roles: string[]): string {
  if (roles.includes("super_admin")) return ROLE_BADGES.super_admin;
  if (roles.includes("admin")) return ROLE_BADGES.admin;
  return ROLE_BADGES.teacher;
}

export function StaffList({ staff, allDisciplines }: { staff: StaffMember[]; allDisciplines: string[] }) {
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive" | "all">(
    (searchParams.get("status") as any) ?? "active"
  );
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [discFilter, setDiscFilter] = useState<string[]>([]);

  // Filter
  const filtered = staff.filter((s) => {
    // Active filter
    if (activeFilter === "active" && !s.isActive) return false;
    if (activeFilter === "inactive" && s.isActive) return false;

    // Role filter
    if (roleFilter.length > 0) {
      const hasRole = roleFilter.some((r) => s.roles.includes(r));
      if (!hasRole) return false;
    }

    // Discipline filter
    if (discFilter.length > 0) {
      const hasDisc = discFilter.some((d) => s.disciplines.some((sd) => sd.name === d));
      if (!hasDisc) return false;
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = `${s.firstName ?? ""} ${s.lastName ?? ""}`.toLowerCase();
      const email = (s.email ?? "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }

    return true;
  });

  const activeCount = staff.filter((s) => s.isActive).length;

  function toggleChip(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">Staff</h1>
          <p className="mt-1 text-sm text-slate">
            {filtered.length} of {staff.length} staff members
            {activeFilter === "active" && ` · ${activeCount} active`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-silver bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] h-9 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none"
          />

          {/* Active toggle */}
          <div className="flex rounded-lg border border-silver overflow-hidden">
            {(["active", "inactive", "all"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setActiveFilter(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === v ? "bg-lavender text-white" : "text-slate hover:bg-cloud"
                }`}
              >
                {v === "active" ? "Active" : v === "inactive" ? "Inactive" : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Role chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-mist">Roles:</span>
          {["teacher", "admin"].map((role) => (
            <button
              key={role}
              onClick={() => toggleChip(roleFilter, role, setRoleFilter)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                roleFilter.includes(role) ? "bg-lavender text-white" : "bg-cloud text-slate hover:bg-silver/50"
              }`}
            >
              {role === "teacher" ? "Teacher" : "Admin"}
            </button>
          ))}

          {allDisciplines.length > 0 && (
            <>
              <span className="text-xs text-mist ml-2">Disciplines:</span>
              {allDisciplines.slice(0, 8).map((d) => (
                <button
                  key={d}
                  onClick={() => toggleChip(discFilter, d, setDiscFilter)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    discFilter.includes(d) ? "bg-lavender text-white" : "bg-cloud text-slate hover:bg-silver/50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </>
          )}

          {(roleFilter.length > 0 || discFilter.length > 0) && (
            <button
              onClick={() => { setRoleFilter([]); setDiscFilter([]); }}
              className="text-xs text-mist hover:text-slate"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Staff grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-mist">No staff members match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => {
            const name = [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown";
            const initials = `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase();
            const isCompliant = s.compliance.mandated && s.compliance.background && s.compliance.w9;

            return (
              <div
                key={s.id}
                className={`rounded-xl border border-silver bg-white p-4 transition-shadow hover:shadow-sm ${
                  !s.isActive ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="h-[60px] w-[60px] rounded-full bg-lavender/20 flex items-center justify-center text-lavender text-lg font-heading font-bold shrink-0 overflow-hidden">
                    {s.avatarUrl ? (
                      <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-charcoal">{name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClass(s.roles)}`}>
                        {getRoleLabel(s.roles)}
                      </span>
                      {!s.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-error/10 text-error font-medium">Inactive</span>
                      )}
                    </div>
                    {s.title && <p className="text-xs text-lavender-dark mt-0.5">{s.title}</p>}
                    {s.email && <p className="text-sm text-slate mt-0.5">{s.email}</p>}
                    <p className="text-xs text-mist mt-1">{s.classCount} class{s.classCount !== 1 ? "es" : ""}</p>

                    {/* Discipline icons */}
                    {s.disciplines.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {s.disciplines.slice(0, 4).map((d, i) => (
                          <div key={i} className="flex items-center gap-1" title={d.name}>
                            {d.iconUrl ? (
                              <img src={d.iconUrl} alt={d.name} className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <span className="h-5 w-5 rounded-full bg-lavender/20 flex items-center justify-center text-[8px] text-lavender font-bold">
                                {d.name[0]}
                              </span>
                            )}
                          </div>
                        ))}
                        {s.disciplines.length > 4 && (
                          <span className="text-[10px] text-mist">+{s.disciplines.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Compliance */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.compliance.mandated ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                        MR {s.compliance.mandated ? "✓" : "✕"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.compliance.background ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                        BG {s.compliance.background ? "✓" : "✕"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.compliance.w9 ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                        W9 {s.compliance.w9 ? "✓" : "✕"}
                      </span>
                      {isCompliant && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">Compliant</span>
                      )}
                    </div>

                    {/* Profile link */}
                    <Link
                      href={`/admin/staff/${s.id}/profile`}
                      className="inline-block mt-2 text-xs text-lavender hover:text-lavender-dark font-medium"
                    >
                      View Full Profile →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
