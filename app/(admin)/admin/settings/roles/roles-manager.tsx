"use client";

import { useState } from "react";

interface RoleAssignment {
  id: string;
  userId: string;
  role: string;
  isPrimary: boolean;
  assignedAt: string;
  userName: string;
  userEmail: string;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  roles: string[];
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

const ALL_ROLES = [
  { value: "super_admin", label: "Super Admin", color: "bg-error/10 text-error" },
  { value: "admin", label: "Admin", color: "bg-lavender/10 text-lavender-dark" },
  { value: "studio_admin", label: "Studio Admin", color: "bg-lavender/10 text-lavender-dark" },
  { value: "finance_admin", label: "Finance Admin", color: "bg-info/10 text-info" },
  { value: "studio_manager", label: "Studio Manager", color: "bg-gold/10 text-gold-dark" },
  { value: "front_desk", label: "Front Desk", color: "bg-gold/10 text-gold-dark" },
  { value: "teacher", label: "Teacher", color: "bg-success/10 text-success" },
  { value: "parent", label: "Parent", color: "bg-cloud text-slate" },
  { value: "student", label: "Student", color: "bg-cloud text-slate" },
];

function roleBadge(role: string) {
  const r = ALL_ROLES.find((ar) => ar.value === role);
  return r?.color ?? "bg-cloud text-slate";
}

function roleLabel(role: string) {
  return ALL_ROLES.find((ar) => ar.value === role)?.label ?? role;
}

export function RolesManager({
  roleAssignments: initialAssignments,
  permissionCategories,
  allUsers,
  isSuperAdmin,
}: {
  roleAssignments: RoleAssignment[];
  permissionCategories: Record<string, Permission[]>;
  allUsers: UserOption[];
  isSuperAdmin: boolean;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [tab, setTab] = useState<"assignments" | "matrix">("assignments");
  const [showAssign, setShowAssign] = useState(false);

  // Group assignments by user
  const userGroups: Record<string, RoleAssignment[]> = {};
  for (const a of assignments) {
    const key = a.userId;
    if (!userGroups[key]) userGroups[key] = [];
    userGroups[key].push(a);
  }

  const sortedUsers = Object.entries(userGroups).sort(([, a], [, b]) => {
    // Sort admins first
    const adminRoles = ["super_admin", "admin", "studio_admin"];
    const aIsAdmin = a.some((r) => adminRoles.includes(r.role));
    const bIsAdmin = b.some((r) => adminRoles.includes(r.role));
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    return a[0].userName.localeCompare(b[0].userName);
  });

  async function handleRemoveRole(roleId: string) {
    const res = await fetch(`/api/admin/roles?id=${roleId}`, { method: "DELETE" });
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== roleId));
    }
  }

  async function handleAssignRole(userId: string, role: string, isPrimary: boolean) {
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role, isPrimary }),
    });
    if (res.ok) {
      const user = allUsers.find((u) => u.id === userId);
      setAssignments((prev) => [
        ...prev.filter((a) => !(a.userId === userId && a.role === role)),
        {
          id: crypto.randomUUID(),
          userId,
          role,
          isPrimary,
          assignedAt: new Date().toISOString(),
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
        },
      ]);
      setShowAssign(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-silver">
        <button
          onClick={() => setTab("assignments")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "assignments"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-slate hover:text-charcoal"
          }`}
        >
          Role Assignments
        </button>
        <button
          onClick={() => setTab("matrix")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "matrix"
              ? "border-lavender text-lavender-dark"
              : "border-transparent text-slate hover:text-charcoal"
          }`}
        >
          Permission Matrix
        </button>
      </div>

      {tab === "assignments" ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate">
              {sortedUsers.length} user{sortedUsers.length !== 1 ? "s" : ""} with roles assigned
            </p>
            <button
              onClick={() => setShowAssign(true)}
              className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-4 transition-colors"
            >
              + Assign Role
            </button>
          </div>

          {/* Assign dialog */}
          {showAssign && (
            <AssignRoleDialog
              users={allUsers}
              isSuperAdmin={isSuperAdmin}
              onAssign={handleAssignRole}
              onClose={() => setShowAssign(false)}
            />
          )}

          {/* User role cards */}
          {sortedUsers.map(([userId, userRoles]) => (
            <div
              key={userId}
              className="rounded-xl border border-silver bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal truncate">
                    {userRoles[0].userName}
                  </p>
                  <p className="text-xs text-mist truncate">
                    {userRoles[0].userEmail}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {userRoles.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1"
                    >
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge(r.role)}`}
                      >
                        {roleLabel(r.role)}
                        {r.isPrimary && (
                          <span className="ml-1 text-[10px] opacity-60">
                            (primary)
                          </span>
                        )}
                      </span>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleRemoveRole(r.id)}
                          className="text-[10px] text-mist hover:text-error transition-colors"
                          title="Remove role"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {sortedUsers.length === 0 && (
            <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
              No role assignments found. Run the migration to seed existing roles.
            </div>
          )}
        </div>
      ) : (
        /* Permission Matrix */
        <div className="space-y-6">
          <p className="text-sm text-slate">
            View which permissions are granted to each role. Modify role
            permissions by contacting your platform administrator.
          </p>

          {Object.entries(permissionCategories).map(([category, perms]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-mist">
                {category}
              </h3>
              <div className="rounded-xl border border-silver bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-silver bg-cloud/50">
                        <th className="px-3 py-2 text-left font-medium text-slate w-48">
                          Permission
                        </th>
                        {ALL_ROLES.map((r) => (
                          <th
                            key={r.value}
                            className="px-2 py-2 text-center font-medium text-slate whitespace-nowrap"
                          >
                            {r.label.split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-silver/50">
                      {perms.map((p) => (
                        <tr key={p.id} className="hover:bg-cloud/20">
                          <td className="px-3 py-2 text-charcoal" title={p.description ?? ""}>
                            {p.label}
                          </td>
                          {ALL_ROLES.map((r) => (
                            <td key={r.value} className="px-2 py-2 text-center">
                              {p.roles.includes(r.value) ? (
                                <span className="text-success font-bold">
                                  &#10003;
                                </span>
                              ) : (
                                <span className="text-silver">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignRoleDialog({
  users,
  isSuperAdmin,
  onAssign,
  onClose,
}: {
  users: UserOption[];
  isSuperAdmin: boolean;
  onAssign: (userId: string, role: string, isPrimary: boolean) => void;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("teacher");
  const [isPrimary, setIsPrimary] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const availableRoles = isSuperAdmin
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r.value !== "super_admin");

  return (
    <div className="rounded-xl border border-lavender/30 bg-lavender/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-charcoal">
          Assign Role
        </h3>
        <button
          onClick={onClose}
          className="text-slate hover:text-charcoal text-sm"
        >
          Cancel
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          User
        </label>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none mb-1"
        />
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:outline-none"
        >
          <option value="">Select user...</option>
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:outline-none"
        >
          {availableRoles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
        />
        Set as primary role
      </label>

      <button
        onClick={() => userId && onAssign(userId, role, isPrimary)}
        disabled={!userId}
        className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
      >
        Assign Role
      </button>
    </div>
  );
}
