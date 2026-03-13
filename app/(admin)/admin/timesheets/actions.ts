"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

// ── Admin Entry CRUD ──────────────────────────────────────────

const CATEGORY_TO_ENTRY_TYPE: Record<string, string> = {
  class: "class_lead",
  private: "private",
  rehearsal: "rehearsal",
  admin: "admin",
  other: "bonus",
};

const adminEntrySchema = z.object({
  teacherProfileId: z.string().uuid(),
  date: z.string().date(),
  category: z.enum(["class", "private", "rehearsal", "admin", "other"]),
  totalHours: z.number().min(0.5).max(24),
  description: z.string().max(500).optional(),
  subFor: z.string().max(200).optional(),
  productionId: z.string().uuid().optional(),
  productionName: z.string().max(200).optional(),
  eventTag: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

async function getOrCreateTimesheetForTeacher(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherProfileId: string,
  tenantId: string
) {
  const { data: existing } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("teacher_id", teacherProfileId)
    .in("status", ["draft", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("id")
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  if (!payPeriod) {
    const deadline = new Date(year, month - 1, 26);
    const { data: created } = await supabase
      .from("pay_periods")
      .insert({
        tenant_id: tenantId,
        period_month: month,
        period_year: year,
        submission_deadline: deadline.toISOString().split("T")[0],
        status: "open",
      })
      .select("id")
      .single();
    payPeriod = created;
  }

  if (!payPeriod) return null;

  const { data: newTs } = await supabase
    .from("timesheets")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherProfileId,
      pay_period_id: payPeriod.id,
      status: "draft",
    })
    .select("id, status")
    .single();

  return newTs;
}

export async function adminAddEntry(formData: FormData) {
  const { supabase, user, error: authError } = await requireFinanceAdmin();
  if (authError || !user) return { error: authError ?? "Unauthorized" };

  const parsed = adminEntrySchema.safeParse({
    teacherProfileId: formData.get("teacherProfileId"),
    date: formData.get("date"),
    category: formData.get("category"),
    totalHours: parseFloat(formData.get("totalHours") as string),
    description: formData.get("description") || undefined,
    subFor: formData.get("subFor") || undefined,
    productionId: formData.get("productionId") || undefined,
    productionName: formData.get("productionName") || undefined,
    eventTag: formData.get("eventTag") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;

  const { data: tp } = await supabase
    .from("teacher_profiles")
    .select("id, tenant_id")
    .eq("id", d.teacherProfileId)
    .single();

  if (!tp) return { error: "Teacher not found." };

  const timesheet = await getOrCreateTimesheetForTeacher(supabase, tp.id, tp.tenant_id);
  if (!timesheet) return { error: "Could not create timesheet." };

  const { error } = await supabase.from("timesheet_entries").insert({
    tenant_id: tp.tenant_id,
    timesheet_id: timesheet.id,
    entry_type: CATEGORY_TO_ENTRY_TYPE[d.category] ?? "admin",
    date: d.date,
    total_hours: d.totalHours,
    description: d.description || null,
    sub_for: d.subFor || null,
    production_id: d.productionId || null,
    production_name: d.productionName || null,
    event_tag: d.eventTag || null,
    notes: d.notes || null,
  });

  if (error) {
    console.error("[admin:addEntry]", error);
    return { error: "Failed to add entry." };
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function adminUpdateEntry(formData: FormData) {
  const { supabase, error: authError } = await requireFinanceAdmin();
  if (authError) return { error: authError };

  const entryId = formData.get("entryId") as string;
  if (!entryId) return { error: "Entry ID required." };

  const parsed = adminEntrySchema.omit({ teacherProfileId: true }).safeParse({
    date: formData.get("date"),
    category: formData.get("category"),
    totalHours: parseFloat(formData.get("totalHours") as string),
    description: formData.get("description") || undefined,
    subFor: formData.get("subFor") || undefined,
    productionId: formData.get("productionId") || undefined,
    productionName: formData.get("productionName") || undefined,
    eventTag: formData.get("eventTag") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      entry_type: CATEGORY_TO_ENTRY_TYPE[d.category] ?? "admin",
      date: d.date,
      total_hours: d.totalHours,
      description: d.description || null,
      sub_for: d.subFor || null,
      production_id: d.productionId || null,
      production_name: d.productionName || null,
      event_tag: d.eventTag || null,
      notes: d.notes || null,
    })
    .eq("id", entryId);

  if (error) {
    console.error("[admin:updateEntry]", error);
    return { error: "Failed to update entry." };
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function adminDeleteEntry(formData: FormData) {
  const { supabase, error: authError } = await requireFinanceAdmin();
  if (authError) return { error: authError };

  const entryId = formData.get("entryId") as string;
  if (!entryId) return { error: "Entry ID required." };

  const { error } = await supabase
    .from("timesheet_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("[admin:deleteEntry]", error);
    return { error: "Failed to delete entry." };
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}
