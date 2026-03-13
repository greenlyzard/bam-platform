"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ALLOWED_ROLES = ["finance_admin", "admin", "super_admin"];

async function requireFinanceAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { supabase, user: null, error: "Finance Admin required" };
  }

  return { supabase, user, error: null };
}

export async function approveTimesheet(formData: FormData) {
  const { supabase, user, error: authError } = await requireFinanceAdmin();
  if (authError || !user) return { error: authError ?? "Unauthorized" };

  const timesheetId = formData.get("timesheetId") as string;

  const { data: ts } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("id", timesheetId)
    .single();

  if (!ts) return { error: "Timesheet not found." };
  if (ts.status !== "submitted") {
    return { error: "Only submitted timesheets can be approved." };
  }

  const { error } = await supabase
    .from("timesheets")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", timesheetId);

  if (error) {
    console.error("[admin:approveTimesheet]", error);
    return { error: "Failed to approve." };
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function returnTimesheet(formData: FormData) {
  const { supabase, user, error: authError } = await requireFinanceAdmin();
  if (authError || !user) return { error: authError ?? "Unauthorized" };

  const timesheetId = formData.get("timesheetId") as string;
  const notes = (formData.get("notes") as string) || null;

  const { data: ts } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("id", timesheetId)
    .single();

  if (!ts) return { error: "Timesheet not found." };
  if (ts.status !== "submitted") {
    return { error: "Only submitted timesheets can be returned." };
  }

  const { error } = await supabase
    .from("timesheets")
    .update({
      status: "draft",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_notes: notes,
      submitted_at: null,
    })
    .eq("id", timesheetId);

  if (error) {
    console.error("[admin:returnTimesheet]", error);
    return { error: "Failed to return timesheet." };
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}
