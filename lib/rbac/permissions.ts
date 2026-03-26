import { createClient } from "@/lib/supabase/server";

/**
 * Check if user has finance_admin or super_admin role.
 * Required for viewing pay rates, approving timesheets, and exporting payroll.
 */
async function hasFinanceRole(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile_roles")
      .select("id")
      .eq("user_id", userId)
      .in("role", ["finance_admin", "super_admin"])
      .eq("is_active", true)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function canViewPayRates(userId: string): Promise<boolean> {
  return hasFinanceRole(userId);
}

export async function canApproveTimesheets(userId: string): Promise<boolean> {
  return hasFinanceRole(userId);
}

export async function canExportPayroll(userId: string): Promise<boolean> {
  return hasFinanceRole(userId);
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .eq("is_active", true)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
