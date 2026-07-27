import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_TENANT_TIMEZONE } from "@/lib/dates";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve a tenant's IANA timezone from `tenants.timezone`.
 *
 * Two ways to reach a tenant's zone on the server:
 *
 *   1. Anything behind a guard → `AuthUser.timezone` (lib/auth/guards.ts). Free,
 *      already resolved. Prefer this.
 *   2. Anything holding only a `tenantId` — server actions that resolve the
 *      tenant from `profile_roles`, crons, webhooks — → this function.
 *
 * `profile_roles.tenant_id` has no FK to `tenants` (verified against
 * pg_constraint), so PostgREST cannot embed the zone into a `profile_roles`
 * select. It is always a separate round trip, which is what the cache below is
 * for.
 *
 * See docs/TENANT_TIMEZONE_SPEC.md §4.3.
 */

/**
 * Process-local cache of tenant id → IANA timezone.
 *
 * A tenant's zone changes approximately never, so a short TTL makes the
 * steady-state cost nil in a warm lambda while still picking up an onboarding
 * change within five minutes. Only successful lookups are cached — a failure
 * (e.g. the migration not yet pushed) is retried on the next call, so the
 * fallback can never stick in a warm process.
 *
 * Shared by every caller, including lib/auth/guards.ts, so a request that hits
 * both a guard and a server action pays for at most one lookup.
 */
const TENANT_TZ_TTL_MS = 5 * 60 * 1000;
const tenantTimezoneCache = new Map<
  string,
  { timezone: string; expiresAt: number }
>();

export async function getTenantTimezone(
  supabase: SupabaseClient,
  tenantId: string | null
): Promise<string> {
  if (!tenantId) return DEFAULT_TENANT_TIMEZONE;

  const cached = tenantTimezoneCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.timezone;

  const { data, error } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .single();

  const timezone = (data as { timezone?: string | null } | null)?.timezone;
  if (error || !timezone) return DEFAULT_TENANT_TIMEZONE;

  tenantTimezoneCache.set(tenantId, {
    timezone,
    expiresAt: Date.now() + TENANT_TZ_TTL_MS,
  });
  return timezone;
}
