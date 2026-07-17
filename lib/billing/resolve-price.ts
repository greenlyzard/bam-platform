// Class price resolution — the single source of truth for "what does a class cost per month".
// The admin class editor writes the base price into `class_pricing_rules.amount` (in DOLLARS,
// numeric). Legacy rows may instead carry `classes.fee_cents` (already integer cents). This module
// resolves either into integer cents and is the ONLY place a dollars→cents conversion is allowed.

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The ONE dollars→cents conversion in the codebase. `class_pricing_rules.amount` is a numeric
 * DOLLAR value (e.g. 125.00); every price downstream is integer cents. Do not inline `* 100`
 * anywhere else — route it through here so rounding stays consistent.
 */
export function dollarsToPriceCents(amountDollars: number | string): number {
  return Math.round(Number(amountDollars) * 100);
}

/**
 * Resolve a class's monthly tuition in integer cents.
 *
 * Precedence:
 *   1. base-price row in `class_pricing_rules` (dollars — where the admin editor writes)
 *   2. legacy `classes.fee_cents` (already cents)
 *   3. `null` — an unpriced class, which callers MUST treat as not purchasable.
 *
 * Defaults to the service-role client: `class_pricing_rules` and `classes.fee_cents` must resolve
 * even for anonymous enrollees on the public /enroll flow (RLS on `class_pricing_rules` is
 * authenticated-only), and base prices are public-facing. Callers may pass an existing admin/server
 * client to reuse the connection.
 */
export async function resolveClassPriceCents(
  classId: string,
  client?: SupabaseClient
): Promise<number | null> {
  const supabase = client ?? createAdminClient();

  const { data: rule } = await supabase
    .from("class_pricing_rules")
    .select("amount")
    .eq("class_id", classId)
    .eq("is_base_price", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (rule?.amount != null) {
    return dollarsToPriceCents(rule.amount as number);
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("fee_cents")
    .eq("id", classId)
    .maybeSingle();

  if (cls?.fee_cents != null) {
    return cls.fee_cents as number;
  }

  return null;
}
