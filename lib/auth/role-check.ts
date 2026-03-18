import type { AuthUser } from "./guards";

const ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "studio_admin",
  "finance_admin",
  "studio_manager",
]);

/**
 * Returns true if the user's only active role is 'teacher' —
 * i.e. they do NOT also hold an admin/super_admin role.
 *
 * Uses the `roles` array from AuthUser (populated from profile_roles).
 * No extra DB query needed when called with a fully-loaded AuthUser.
 */
export function isTeacherOnly(user: AuthUser): boolean {
  return (
    user.roles.includes("teacher") &&
    !user.roles.some((r) => ADMIN_ROLES.has(r))
  );
}

/**
 * Strip contact fields (email, phone) from an object when the
 * requesting user is teacher-only. Returns a shallow copy.
 */
export function redactContactFields<T extends Record<string, unknown>>(
  obj: T,
  user: AuthUser,
  fields: string[] = ["email", "phone", "billing_email", "billing_phone", "contact_email"]
): T {
  if (!isTeacherOnly(user)) return obj;
  const copy = { ...obj };
  for (const field of fields) {
    if (field in copy) {
      (copy as Record<string, unknown>)[field] = null;
    }
  }
  return copy;
}
