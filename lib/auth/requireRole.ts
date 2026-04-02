import { redirect } from "next/navigation";
import {
  getSessionWithRole,
  type Role,
  type SessionWithRole,
} from "./getSessionWithRole";

/**
 * Require the user to have one of the specified roles.
 * Redirects to /login if not authenticated.
 * Redirects to /unauthorized if role is not allowed.
 */
export async function requireRole(
  allowed: Role[]
): Promise<SessionWithRole> {
  const session = await getSessionWithRole();

  if (!session) {
    redirect("/login");
  }

  const hasRole = session.profile.roles.some((r) => allowed.includes(r));
  if (!hasRole && !allowed.includes(session.profile.role)) {
    redirect("/unauthorized");
  }

  return session;
}
