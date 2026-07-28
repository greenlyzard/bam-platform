/**
 * Platform roles assignable to a staff member from the admin UI.
 *
 * `profile_roles` is the source of truth for authorization. A person holds one
 * row per role — UNIQUE (user_id, tenant_id, role) — and may hold several at
 * once (Amanda holds four). `profile_roles.role` is plain TEXT with no check
 * constraint, so this list, not a database enum, is what bounds the values the
 * UI is allowed to write.
 *
 * Keep the values in sync with ADMIN_TIER_ROLES in lib/auth/guards.ts and
 * is_admin() in the database: every admin-tier role listed here grants the
 * admin surface, which is why granting one is gated to super_admin.
 */
export const STAFF_ROLE_OPTIONS = [
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Admin" },
  { value: "studio_admin", label: "Studio Admin" },
  { value: "studio_manager", label: "Studio Manager" },
  { value: "finance_admin", label: "Finance Admin" },
  { value: "super_admin", label: "Studio Owner" },
  { value: "parent", label: "Parent" },
] as const;

export type StaffRole = (typeof STAFF_ROLE_OPTIONS)[number]["value"];

export const STAFF_ROLE_VALUES: readonly string[] = STAFF_ROLE_OPTIONS.map(
  (o) => o.value
);

export function isStaffRole(value: string): value is StaffRole {
  return STAFF_ROLE_VALUES.includes(value);
}

/**
 * Human label for a role string. Falls back to a title-cased version of the
 * raw value so legacy roles not in the option list (front_desk, student) still
 * render readably where existing assignments are displayed.
 */
export function staffRoleLabel(role: string): string {
  const known = STAFF_ROLE_OPTIONS.find((o) => o.value === role);
  if (known) return known.label;
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type LegacyProfileRole = "super_admin" | "admin" | "teacher" | "parent";

const LEGACY_ADMIN_EQUIVALENTS = [
  "admin",
  "studio_admin",
  "studio_manager",
  "finance_admin",
];

/**
 * LEGACY MIRROR ONLY — `profile_roles` is authoritative.
 *
 * `profiles.role` is a stale single-role column typed as the `user_role` enum,
 * whose labels are only super_admin | admin | teacher | parent | student |
 * front_desk. It therefore cannot represent finance_admin, studio_admin, or
 * studio_manager, and it cannot represent holding more than one role at all.
 * Nothing should authorize off it — but roughly thirty API routes still read
 * it, so it is collapsed from the real role set and written alongside, never
 * instead of, the `profile_roles` rows.
 */
export function legacyProfileRole(roles: readonly string[]): LegacyProfileRole {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.some((r) => LEGACY_ADMIN_EQUIVALENTS.includes(r))) return "admin";
  if (roles.includes("teacher")) return "teacher";
  return "parent";
}
