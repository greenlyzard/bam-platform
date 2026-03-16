"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ENTRY_TYPES = [
  "class_lead",
  "class_assistant",
  "private",
  "rehearsal",
  "performance_event",
  "competition",
  "training",
  "admin",
  "substitute",
  "bonus",
] as const;

const CATEGORY_TO_ENTRY_TYPE: Record<string, string> = {
  class: "class_lead",
  private: "private",
  rehearsal: "rehearsal",
  admin: "admin",
  other: "bonus",
};

const entrySchema = z.object({
  date: z.string().date("Valid date is required"),
  entryType: z.enum(ENTRY_TYPES).optional(),
  category: z.enum(["class", "private", "rehearsal", "admin", "other"]).optional(),
  totalHours: z.number().positive().max(24),
  description: z.string().max(500).optional(),
  subFor: z.string().max(200).optional(),
  productionId: z.string().uuid().optional(),
  productionName: z.string().max(200).optional(),
  eventTag: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  classId: z.string().uuid().optional(),
});

/** Get or create a draft timesheet for this teacher / current pay period */
async function getOrCreateTimesheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherProfileId: string,
  tenantId: string
) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Try to find existing timesheet for this month
  const { data: existing } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("teacher_id", teacherProfileId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // Find or create a pay period
  let { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("id")
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  if (!payPeriod) {
    const deadline = new Date(year, month - 1, 26);
    const { data: created, error } = await supabase
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

    if (error) {
      console.error("[timesheets:createPayPeriod]", error);
      return null;
    }
    payPeriod = created;
  }

  // Create the timesheet
  const { data: newTs, error: tsError } = await supabase
    .from("timesheets")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherProfileId,
      pay_period_id: payPeriod!.id,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (tsError) {
    console.error("[timesheets:createTimesheet]", tsError);
    return null;
  }

  return newTs;
}

async function getTeacherContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tp } = await supabase
    .from("teacher_profiles")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();

  return tp;
}

function isPeriodLocked(): boolean {
  const now = new Date();
  return now.getDate() > 26;
}

function resolveEntryType(formData: FormData): string {
  const category = formData.get("category") as string | null;
  if (category && CATEGORY_TO_ENTRY_TYPE[category]) {
    return CATEGORY_TO_ENTRY_TYPE[category];
  }
  return (formData.get("entryType") as string) || "class_lead";
}

export async function addTimesheetEntry(formData: FormData) {
  if (isPeriodLocked()) {
    return { error: "Pay period is locked after the 26th." };
  }

  const supabase = await createClient();
  const tp = await getTeacherContext(supabase);
  if (!tp) return { error: "Teacher profile not found." };

  const parsed = entrySchema.safeParse({
    date: formData.get("date"),
    entryType: formData.get("entryType") || undefined,
    category: formData.get("category") || undefined,
    totalHours: parseFloat(formData.get("totalHours") as string),
    description: formData.get("description") || undefined,
    subFor: formData.get("subFor") || undefined,
    productionId: formData.get("productionId") || undefined,
    productionName: formData.get("productionName") || undefined,
    eventTag: formData.get("eventTag") || undefined,
    notes: formData.get("notes") || undefined,
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    classId: formData.get("classId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const timesheet = await getOrCreateTimesheet(supabase, tp.id, tp.tenant_id);
  if (!timesheet) return { error: "Could not create timesheet." };
  if (timesheet.status !== "draft") {
    return { error: "Timesheet already submitted — cannot add entries." };
  }

  const entryType = resolveEntryType(formData);

  const { error } = await supabase.from("timesheet_entries").insert({
    tenant_id: tp.tenant_id,
    timesheet_id: timesheet.id,
    entry_type: entryType,
    date: parsed.data.date,
    total_hours: parsed.data.totalHours,
    description: parsed.data.description || null,
    sub_for: parsed.data.subFor || null,
    production_id: parsed.data.productionId || null,
    production_name: parsed.data.productionName || null,
    event_tag: parsed.data.eventTag || null,
    notes: parsed.data.notes || null,
    start_time: parsed.data.startTime || null,
    end_time: parsed.data.endTime || null,
    class_id: parsed.data.classId || null,
  });

  if (error) {
    console.error("[timesheets:addEntry]", error);
    return { error: "Failed to add entry." };
  }

  revalidatePath("/teach/timesheets");
  return { success: true };
}

export async function updateTimesheetEntry(formData: FormData) {
  if (isPeriodLocked()) {
    return { error: "Pay period is locked after the 26th." };
  }

  const supabase = await createClient();
  const tp = await getTeacherContext(supabase);
  if (!tp) return { error: "Teacher profile not found." };

  const entryId = formData.get("entryId") as string;

  const parsed = entrySchema.safeParse({
    date: formData.get("date"),
    entryType: formData.get("entryType") || undefined,
    category: formData.get("category") || undefined,
    totalHours: parseFloat(formData.get("totalHours") as string),
    description: formData.get("description") || undefined,
    subFor: formData.get("subFor") || undefined,
    productionId: formData.get("productionId") || undefined,
    productionName: formData.get("productionName") || undefined,
    eventTag: formData.get("eventTag") || undefined,
    notes: formData.get("notes") || undefined,
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    classId: formData.get("classId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Verify ownership via timesheet
  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("timesheet_id, timesheets(teacher_id, status)")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };

  const ts = entry.timesheets as unknown as {
    teacher_id: string;
    status: string;
  };
  if (ts.teacher_id !== tp.id) return { error: "Not your entry." };
  if (ts.status !== "draft") {
    return { error: "Timesheet already submitted — cannot edit entries." };
  }

  const entryType = resolveEntryType(formData);

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      entry_type: entryType,
      date: parsed.data.date,
      total_hours: parsed.data.totalHours,
      description: parsed.data.description || null,
      sub_for: parsed.data.subFor || null,
      production_id: parsed.data.productionId || null,
      production_name: parsed.data.productionName || null,
      event_tag: parsed.data.eventTag || null,
      notes: parsed.data.notes || null,
      start_time: parsed.data.startTime || null,
      end_time: parsed.data.endTime || null,
      class_id: parsed.data.classId || null,
    })
    .eq("id", entryId);

  if (error) {
    console.error("[timesheets:updateEntry]", error);
    return { error: "Failed to update entry." };
  }

  revalidatePath("/teach/timesheets");
  return { success: true };
}

export async function deleteTimesheetEntry(formData: FormData) {
  if (isPeriodLocked()) {
    return { error: "Pay period is locked after the 26th." };
  }

  const supabase = await createClient();
  const tp = await getTeacherContext(supabase);
  if (!tp) return { error: "Teacher profile not found." };

  const entryId = formData.get("entryId") as string;

  // Verify ownership
  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("timesheet_id, timesheets(teacher_id, status)")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };

  const ts = entry.timesheets as unknown as {
    teacher_id: string;
    status: string;
  };
  if (ts.teacher_id !== tp.id) return { error: "Not your entry." };
  if (ts.status !== "draft") {
    return { error: "Timesheet already submitted — cannot delete entries." };
  }

  const { error } = await supabase
    .from("timesheet_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("[timesheets:deleteEntry]", error);
    return { error: "Failed to delete entry." };
  }

  revalidatePath("/teach/timesheets");
  return { success: true };
}

export async function submitTimesheet(formData: FormData) {
  const supabase = await createClient();
  const tp = await getTeacherContext(supabase);
  if (!tp) return { error: "Teacher profile not found." };

  const timesheetId = formData.get("timesheetId") as string;

  // Verify ownership and draft status
  const { data: timesheet } = await supabase
    .from("timesheets")
    .select("id, teacher_id, status")
    .eq("id", timesheetId)
    .single();

  if (!timesheet) return { error: "Timesheet not found." };
  if (timesheet.teacher_id !== tp.id) return { error: "Not your timesheet." };
  if (timesheet.status !== "draft") {
    return { error: "Timesheet is not in draft status." };
  }

  // Calculate totals
  const { data: entries } = await supabase
    .from("timesheet_entries")
    .select("id, total_hours")
    .eq("timesheet_id", timesheetId);

  const totalHours = (entries ?? []).reduce(
    (sum, e) => sum + (e.total_hours ?? 0),
    0
  );

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("timesheets")
    .update({
      status: "submitted",
      submitted_at: now,
      total_hours: totalHours,
    })
    .eq("id", timesheetId);

  if (error) {
    console.error("[timesheets:submit]", error);
    return { error: "Failed to submit timesheet." };
  }

  // Also mark all entries as submitted
  for (const entry of entries ?? []) {
    await supabase
      .from("timesheet_entries")
      .update({ status: "submitted", submitted_at: now })
      .eq("id", entry.id);

    await supabase.from("timesheet_entry_changes").insert({
      tenant_id: tp.tenant_id,
      entry_id: entry.id,
      changed_by: (await supabase.auth.getUser()).data.user!.id,
      changed_by_name: null,
      change_type: "submitted",
    });
  }

  revalidatePath("/teach/timesheets");
  return { success: true };
}

export async function respondToFlag(formData: FormData) {
  const supabase = await createClient();
  const tp = await getTeacherContext(supabase);
  if (!tp) return { error: "Teacher profile not found." };

  const entryId = formData.get("entryId") as string;
  const response = formData.get("response") as string;
  if (!entryId || !response?.trim()) return { error: "Response is required." };

  // Verify ownership
  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, status, timesheet_id, timesheets(teacher_id)")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };
  const ts = entry.timesheets as unknown as { teacher_id: string };
  if (ts.teacher_id !== tp.id) return { error: "Not your entry." };
  if (entry.status !== "flagged") return { error: "Entry is not flagged." };

  const now = new Date().toISOString();
  const userId = (await supabase.auth.getUser()).data.user!.id;

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      status: "submitted",
      flag_response: response.trim(),
      flag_responded_at: now,
      submitted_at: now,
    })
    .eq("id", entryId);

  if (error) {
    console.error("[timesheets:respondToFlag]", error);
    return { error: "Failed to submit response." };
  }

  await supabase.from("timesheet_entry_changes").insert({
    tenant_id: entry.tenant_id,
    entry_id: entryId,
    changed_by: userId,
    changed_by_name: null,
    change_type: "flag_responded",
    note: response.trim(),
  });

  revalidatePath("/teach/timesheets");
  return { success: true };
}
