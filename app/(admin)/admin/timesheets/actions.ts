"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ADMIN_ROLES = ["finance_admin", "admin", "super_admin"];

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, isAdmin: false, teacherProfileId: null as string | null, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile) return { supabase, user: null, profile: null, isAdmin: false, teacherProfileId: null as string | null, error: "Unauthorized" };

  const isAdmin = ADMIN_ROLES.includes(profile.role);

  // If teacher, look up their teacher_profile_id
  // teacher_profiles VIEW uses `id` (= profiles.id), not `user_id`
  let teacherProfileId: string | null = null;
  if (profile.role === "teacher") {
    const { data: tp } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    teacherProfileId = tp?.id ?? null;
  }

  // Must be admin or teacher
  if (!isAdmin && profile.role !== "teacher") {
    return { supabase, user: null, profile: null, isAdmin: false, teacherProfileId: null as string | null, error: "Unauthorized" };
  }

  return { supabase, user, profile, isAdmin, teacherProfileId, error: null };
}

async function verifyTeacherEntryAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string,
  teacherProfileId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, timesheet_id, timesheets!inner(teacher_id, status)")
    .eq("id", entryId)
    .single();

  if (!entry) return { allowed: false, error: "Entry not found." };

  const ts = (entry as any).timesheets;
  if (ts.teacher_id !== teacherProfileId) return { allowed: false, error: "Not your entry." };
  if (!["draft", "rejected"].includes(ts.status)) return { allowed: false, error: "Timesheet is not editable." };

  return { allowed: true };
}

async function verifyTeacherTimesheetAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timesheetId: string,
  teacherProfileId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { data: ts } = await supabase
    .from("timesheets")
    .select("id, teacher_id, status")
    .eq("id", timesheetId)
    .single();

  if (!ts) return { allowed: false, error: "Timesheet not found." };
  if (ts.teacher_id !== teacherProfileId) return { allowed: false, error: "Not your timesheet." };
  if (!["draft", "rejected"].includes(ts.status)) return { allowed: false, error: "Timesheet is not editable." };

  return { allowed: true };
}

function getAdminName(profile: { first_name: string | null; last_name: string | null } | null): string {
  if (!profile) return "Admin";
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Admin";
}

async function logChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    tenantId: string;
    entryId: string;
    changedBy: string;
    changedByName: string;
    changeType: string;
    fieldChanged?: string;
    oldValue?: string;
    newValue?: string;
    note?: string;
  }
) {
  await supabase.from("timesheet_entry_changes").insert({
    tenant_id: opts.tenantId,
    entry_id: opts.entryId,
    changed_by: opts.changedBy,
    changed_by_name: opts.changedByName,
    change_type: opts.changeType,
    field_changed: opts.fieldChanged || null,
    old_value: opts.oldValue || null,
    new_value: opts.newValue || null,
    note: opts.note || null,
  });
}

// ── Timesheet-level actions ─────────────────────────────────

export async function approveTimesheet(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const timesheetId = formData.get("timesheetId") as string;

  const { data: ts } = await supabase
    .from("timesheets")
    .select("id, status, tenant_id")
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

  // Also approve all entries in this timesheet
  const { data: entries } = await supabase
    .from("timesheet_entries")
    .select("id")
    .eq("timesheet_id", timesheetId);

  const adminName = getAdminName(profile);
  for (const entry of entries ?? []) {
    await supabase
      .from("timesheet_entries")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq("id", entry.id);

    await logChange(supabase, {
      tenantId: ts.tenant_id,
      entryId: entry.id,
      changedBy: user.id,
      changedByName: adminName,
      changeType: "approved",
    });
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function returnTimesheet(formData: FormData) {
  const { supabase, user, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

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

  // Reset entry statuses back to draft
  await supabase
    .from("timesheet_entries")
    .update({ status: "draft", submitted_at: null })
    .eq("timesheet_id", timesheetId);

  revalidatePath("/admin/timesheets");
  return { success: true };
}

// ── Submit entry (draft → submitted) ────────────────────────

export async function submitTimesheetEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const entryId = formData.get("entryId") as string;
  if (!entryId) return { error: "Entry ID required." };

  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, status, timesheet_id")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };
  if (entry.status !== "draft") return { error: "Only draft entries can be submitted." };

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) {
    console.error("[admin:submitEntry]", error);
    return { error: "Failed to submit entry." };
  }

  // Also update parent timesheet to submitted if still draft
  const { data: ts } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("id", entry.timesheet_id)
    .single();

  if (ts && ts.status === "draft") {
    await supabase
      .from("timesheets")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", ts.id);
  }

  await logChange(supabase, {
    tenantId: entry.tenant_id,
    entryId,
    changedBy: user.id,
    changedByName: getAdminName(profile),
    changeType: "submitted",
  });

  revalidatePath("/admin/timesheets");
  return { success: true };
}

// ── Bulk approve timesheets ─────────────────────────────────

export async function bulkApproveTimesheets(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const idsRaw = formData.get("timesheetIds") as string;
  if (!idsRaw) return { error: "No timesheets selected." };

  let timesheetIds: string[];
  try {
    timesheetIds = JSON.parse(idsRaw);
  } catch {
    return { error: "Invalid timesheet IDs." };
  }

  const adminName = getAdminName(profile);
  const now = new Date().toISOString();
  let approved = 0;

  for (const timesheetId of timesheetIds) {
    const { data: ts } = await supabase
      .from("timesheets")
      .select("id, status, tenant_id")
      .eq("id", timesheetId)
      .single();

    if (!ts || ts.status !== "submitted") continue;

    const { error } = await supabase
      .from("timesheets")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", timesheetId);

    if (error) continue;

    // Approve all entries in this timesheet
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select("id")
      .eq("timesheet_id", timesheetId);

    for (const entry of entries ?? []) {
      await supabase
        .from("timesheet_entries")
        .update({
          status: "approved",
          approved_at: now,
          approved_by: user.id,
        })
        .eq("id", entry.id);

      await logChange(supabase, {
        tenantId: ts.tenant_id,
        entryId: entry.id,
        changedBy: user.id,
        changedByName: adminName,
        changeType: "approved",
        note: "Bulk approved",
      });
    }

    approved++;
  }

  revalidatePath("/admin/timesheets");
  return { success: true, approved };
}

// ── Entry-level approval actions ────────────────────────────

export async function approveTimesheetEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const entryId = formData.get("entryId") as string;
  if (!entryId) return { error: "Entry ID required." };

  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, status")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", entryId);

  if (error) {
    console.error("[admin:approveEntry]", error);
    return { error: "Failed to approve entry." };
  }

  await logChange(supabase, {
    tenantId: entry.tenant_id,
    entryId,
    changedBy: user.id,
    changedByName: getAdminName(profile),
    changeType: "approved",
  });

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function flagTimesheetEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const entryId = formData.get("entryId") as string;
  const question = formData.get("question") as string;
  if (!entryId || !question?.trim()) return { error: "Entry ID and question required." };

  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      status: "flagged",
      flagged_at: new Date().toISOString(),
      flagged_by: user.id,
      flag_question: question.trim(),
    })
    .eq("id", entryId);

  if (error) {
    console.error("[admin:flagEntry]", error);
    return { error: "Failed to flag entry." };
  }

  await logChange(supabase, {
    tenantId: entry.tenant_id,
    entryId,
    changedBy: user.id,
    changedByName: getAdminName(profile),
    changeType: "flagged",
    note: question.trim(),
  });

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function adjustTimesheetEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const entryId = formData.get("entryId") as string;
  const adjustmentNote = formData.get("adjustmentNote") as string;
  if (!entryId) return { error: "Entry ID required." };
  if (!adjustmentNote?.trim()) return { error: "Adjustment note is required." };

  // Get old values for change log
  const { data: oldEntry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, total_hours, entry_type, description, date")
    .eq("id", entryId)
    .single();

  if (!oldEntry) return { error: "Entry not found." };

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
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    classId: formData.get("classId") || undefined,
    scheduleInstanceId: formData.get("scheduleInstanceId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;
  const newHours = d.totalHours;

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      entry_type: CATEGORY_TO_ENTRY_TYPE[d.category] ?? "admin",
      date: d.date,
      total_hours: newHours,
      description: d.description || null,
      sub_for: d.subFor || null,
      production_id: d.productionId || null,
      production_name: d.productionName || null,
      event_tag: d.eventTag || null,
      notes: d.notes || null,
      start_time: d.startTime || null,
      end_time: d.endTime || null,
      class_id: d.classId || null,
      schedule_instance_id: d.scheduleInstanceId || null,
      status: "adjusted",
      adjusted_by: user.id,
      adjustment_note: adjustmentNote.trim(),
    })
    .eq("id", entryId);

  if (error) {
    console.error("[admin:adjustEntry]", error);
    return { error: "Failed to adjust entry." };
  }

  const adminName = getAdminName(profile);

  // Log hours change
  if (oldEntry.total_hours !== newHours) {
    await logChange(supabase, {
      tenantId: oldEntry.tenant_id,
      entryId,
      changedBy: user.id,
      changedByName: adminName,
      changeType: "adjusted",
      fieldChanged: "hours",
      oldValue: String(oldEntry.total_hours),
      newValue: String(newHours),
      note: adjustmentNote.trim(),
    });
  } else {
    await logChange(supabase, {
      tenantId: oldEntry.tenant_id,
      entryId,
      changedBy: user.id,
      changedByName: adminName,
      changeType: "adjusted",
      note: adjustmentNote.trim(),
    });
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

// ── Mark entries as paid ────────────────────────────────────

export async function markEntriesAsPaid(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const dateFrom = formData.get("dateFrom") as string;
  const dateTo = formData.get("dateTo") as string;
  if (!dateFrom || !dateTo) return { error: "Date range required." };

  const { data: entries, error: fetchErr } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id")
    .eq("status", "approved")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .is("paid_at", null);

  if (fetchErr) {
    console.error("[admin:markPaid]", fetchErr);
    return { error: "Failed to fetch entries." };
  }

  const now = new Date().toISOString();
  const adminName = getAdminName(profile);

  for (const entry of entries ?? []) {
    await supabase
      .from("timesheet_entries")
      .update({ status: "paid", paid_at: now })
      .eq("id", entry.id);

    await logChange(supabase, {
      tenantId: entry.tenant_id,
      entryId: entry.id,
      changedBy: user.id,
      changedByName: adminName,
      changeType: "paid",
    });
  }

  revalidatePath("/admin/timesheets");
  revalidatePath("/admin/timesheets/payroll");
  return { success: true, count: (entries ?? []).length };
}

// ── Admin Entry CRUD ──────────────────────────────────────────

const CATEGORY_TO_ENTRY_TYPE: Record<string, string> = {
  class: "class_lead",
  class_assistant: "class_assistant",
  private: "private",
  rehearsal: "rehearsal",
  substitute: "substitute",
  admin: "admin",
  training: "training",
  performance: "performance_event",
  competition: "competition",
  bonus: "bonus",
  other: "bonus",
};

const adminEntrySchema = z.object({
  teacherProfileId: z.string().uuid(),
  date: z.string().date(),
  category: z.enum([
    "class", "class_assistant", "private", "rehearsal", "substitute",
    "admin", "training", "performance", "competition", "bonus", "other"
  ]),
  totalHours: z.number().min(0.25).max(24),
  description: z.string().max(500).optional(),
  subFor: z.string().max(200).optional(),
  productionId: z.string().uuid().optional(),
  productionName: z.string().max(200).optional(),
  eventTag: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  classId: z.string().uuid().optional(),
  scheduleInstanceId: z.string().uuid().optional(),
});

async function getOrCreateTimesheetForTeacher(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherProfileId: string,
  tenantId: string
): Promise<{ id: string; status: string } | { error: string }> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Find or create pay period for this tenant + month
  let { data: payPeriod, error: ppFetchErr } = await supabase
    .from("pay_periods")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  if (ppFetchErr) {
    console.error("[admin:getOrCreateTimesheet] pay_period fetch error:", ppFetchErr);
    return { error: `Pay period lookup failed: ${ppFetchErr.message}` };
  }

  if (!payPeriod) {
    const deadline = new Date(year, month - 1, 26);
    const { data: created, error: ppErr } = await supabase
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

    if (ppErr) {
      console.error("[admin:getOrCreateTimesheet] pay_period insert error:", ppErr);
      return { error: `Could not create pay period: ${ppErr.message}` };
    }
    payPeriod = created;
  }

  if (!payPeriod) return { error: "Pay period could not be resolved." };

  // Look for any existing timesheet for this teacher + pay period (any status)
  const { data: existing, error: tsFetchErr } = await supabase
    .from("timesheets")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("teacher_id", teacherProfileId)
    .eq("pay_period_id", payPeriod.id)
    .maybeSingle();

  if (tsFetchErr) {
    console.error("[admin:getOrCreateTimesheet] timesheet fetch error:", tsFetchErr);
    return { error: `Timesheet lookup failed: ${tsFetchErr.message}` };
  }

  if (existing) return existing;

  // Create a new draft timesheet
  const { data: newTs, error: tsErr } = await supabase
    .from("timesheets")
    .insert({
      tenant_id: tenantId,
      teacher_id: teacherProfileId,
      pay_period_id: payPeriod.id,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (tsErr) {
    console.error("[admin:getOrCreateTimesheet] timesheet insert error:", tsErr);
    return { error: `Could not create timesheet: ${tsErr.message}` };
  }

  return newTs ?? { error: "Timesheet creation returned no data." };
}

export async function adminAddEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, teacherProfileId, error: authError } = await requireAuth();
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
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    classId: formData.get("classId") || undefined,
    scheduleInstanceId: formData.get("scheduleInstanceId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;

  // Teachers can only add entries to their own timesheet
  if (!isAdmin) {
    if (!teacherProfileId) return { error: "Teacher profile not found." };
    if (d.teacherProfileId !== teacherProfileId) return { error: "You can only add entries to your own timesheet." };
  }

  // Verify teacher exists in teacher_profiles VIEW
  const { data: tp } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("id", d.teacherProfileId)
    .single();

  if (!tp) return { error: "Teacher not found." };

  // Get tenant_id from profile_roles (profiles has no tenant_id).
  // Use maybeSingle — teachers like Amanda may have multiple active roles
  // (e.g. super_admin + teacher), so .single() would fail.
  const { data: teacherRoles } = await supabase
    .from("profile_roles")
    .select("tenant_id")
    .eq("user_id", d.teacherProfileId)
    .eq("is_active", true)
    .limit(1);

  const tenantId = teacherRoles?.[0]?.tenant_id;
  if (!tenantId) return { error: "Teacher has no active tenant role." };

  const timesheetResult = await getOrCreateTimesheetForTeacher(supabase, tp.id, tenantId);
  if ("error" in timesheetResult) return { error: timesheetResult.error };
  const timesheet = timesheetResult;

  // Teachers: verify timesheet is editable
  if (!isAdmin) {
    if (!["draft", "rejected"].includes(timesheet.status)) {
      return { error: "Timesheet is not editable." };
    }
  }

  const { data: newEntry, error } = await supabase
    .from("timesheet_entries")
    .insert({
      tenant_id: tenantId,
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
      start_time: d.startTime || null,
      end_time: d.endTime || null,
      class_id: d.classId || null,
      schedule_instance_id: d.scheduleInstanceId || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !newEntry) {
    console.error("[admin:addEntry]", error);
    return { error: `Failed to add entry: ${error?.message ?? "unknown error"}` };
  }

  // Save production associations to junction table
  const productionIdsRaw = formData.get("productionIds") as string;
  if (productionIdsRaw) {
    try {
      const productionIds = JSON.parse(productionIdsRaw) as string[];
      if (productionIds.length > 0) {
        const rows = productionIds.map((pid) => ({
          timesheet_entry_id: newEntry.id,
          production_id: pid,
        }));
        await supabase.from("teacher_hour_productions").insert(rows);
      }
    } catch { /* ignore parse errors */ }
  }

  await logChange(supabase, {
    tenantId: tenantId,
    entryId: newEntry.id,
    changedBy: user.id,
    changedByName: getAdminName(profile),
    changeType: "created",
    note: `${d.totalHours} hrs ${d.category}`,
  });

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function adminUpdateEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, teacherProfileId, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };

  const entryId = formData.get("entryId") as string;
  if (!entryId) return { error: "Entry ID required." };

  // Teacher: ownership + status check. Admin: skip.
  if (!isAdmin) {
    if (!teacherProfileId) return { error: "Teacher profile not found." };
    const access = await verifyTeacherEntryAccess(supabase, entryId, teacherProfileId);
    if (!access.allowed) return { error: access.error! };
  }

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
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    classId: formData.get("classId") || undefined,
    scheduleInstanceId: formData.get("scheduleInstanceId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;

  // Get old values for change log
  const { data: oldEntry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, total_hours")
    .eq("id", entryId)
    .single();

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
      start_time: d.startTime || null,
      end_time: d.endTime || null,
      class_id: d.classId || null,
      schedule_instance_id: d.scheduleInstanceId || null,
    })
    .eq("id", entryId);

  if (error) {
    console.error("[admin:updateEntry]", error);
    return { error: "Failed to update entry." };
  }

  // Sync production associations
  const productionIdsRaw = formData.get("productionIds") as string;
  if (productionIdsRaw) {
    try {
      const productionIds = JSON.parse(productionIdsRaw) as string[];
      // Delete old associations, insert new
      await supabase
        .from("teacher_hour_productions")
        .delete()
        .eq("timesheet_entry_id", entryId);
      if (productionIds.length > 0) {
        const rows = productionIds.map((pid) => ({
          timesheet_entry_id: entryId,
          production_id: pid,
        }));
        await supabase.from("teacher_hour_productions").insert(rows);
      }
    } catch { /* ignore parse errors */ }
  }

  if (oldEntry && oldEntry.total_hours !== d.totalHours) {
    await logChange(supabase, {
      tenantId: oldEntry.tenant_id,
      entryId,
      changedBy: user.id,
      changedByName: getAdminName(profile),
      changeType: "edited",
      fieldChanged: "hours",
      oldValue: String(oldEntry.total_hours),
      newValue: String(d.totalHours),
    });
  }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

export async function adminDeleteEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, teacherProfileId, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };

  const entryId = formData.get("entryId") as string;
  if (!entryId) return { error: "Entry ID required." };

  // Teacher: ownership + status check. Admin: skip.
  if (!isAdmin) {
    if (!teacherProfileId) return { error: "Teacher profile not found." };
    const access = await verifyTeacherEntryAccess(supabase, entryId, teacherProfileId);
    if (!access.allowed) return { error: access.error! };
  }

  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id")
    .eq("id", entryId)
    .single();

  if (entry) {
    await logChange(supabase, {
      tenantId: entry.tenant_id,
      entryId,
      changedBy: user.id,
      changedByName: getAdminName(profile),
      changeType: "deleted",
    });
  }

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

// ── Rate Override ─────────────────────────────────────────────

export async function rateOverrideEntry(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const entryId = formData.get("entryId") as string;
  const newRate = parseFloat(formData.get("newRate") as string);
  const reason = (formData.get("reason") as string) ?? "";
  const source = (formData.get("source") as string) ?? "Admin Decision";

  if (!entryId || isNaN(newRate)) return { error: "Entry ID and rate required." };

  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, rate_amount")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };

  const { error } = await supabase
    .from("timesheet_entries")
    .update({ rate_amount: newRate, rate_override: true, rate_override_by: user.id })
    .eq("id", entryId);

  if (error) return { error: error.message };

  await logChange(supabase, {
    tenantId: entry.tenant_id,
    entryId,
    changedBy: user.id,
    changedByName: getAdminName(profile),
    changeType: "rate_override",
    fieldChanged: "rate_amount",
    oldValue: entry.rate_amount != null ? String(entry.rate_amount) : undefined,
    newValue: String(newRate),
    note: `${reason}${source ? ` [Source: ${source}]` : ""}`,
  });

  revalidatePath("/admin/timesheets");
  return { success: true };
}

// ── Teacher Flag Response ─────────────────────────────────────

export async function respondToFlag(formData: FormData) {
  const { supabase, user, profile, teacherProfileId, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };

  const entryId = formData.get("entryId") as string;
  const response = (formData.get("response") as string) ?? "";

  if (!entryId || !response.trim()) return { error: "Entry ID and response required." };

  if (teacherProfileId) {
    const access = await verifyTeacherEntryAccess(supabase, entryId, teacherProfileId);
    if (!access.allowed) return { error: access.error ?? "Not authorized" };
  }

  const { data: entry } = await supabase
    .from("timesheet_entries")
    .select("id, tenant_id, status")
    .eq("id", entryId)
    .single();

  if (!entry) return { error: "Entry not found." };
  if (entry.status !== "flagged") return { error: "Entry is not flagged." };

  const { error } = await supabase
    .from("timesheet_entries")
    .update({ flag_response: response.trim(), flag_responded_at: new Date().toISOString(), status: "submitted" })
    .eq("id", entryId);

  if (error) return { error: error.message };

  const teacherName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : "Teacher";

  await logChange(supabase, {
    tenantId: entry.tenant_id, entryId, changedBy: user.id,
    changedByName: teacherName, changeType: "flag_resolved", note: response.trim(),
  });

  // Notify admins
  try {
    const { data: adminRoles } = await supabase
      .from("profile_roles").select("user_id")
      .in("role", ["finance_admin", "admin", "super_admin"]).eq("is_active", true);
    if (adminRoles?.length) {
      await supabase.from("notifications").insert(
        adminRoles.map((r) => ({
          recipient_id: r.user_id, notification_type: "timesheet_flag_response",
          title: `${teacherName} responded to your question`,
          body: `Review the response in timesheets.`, metadata: { entry_id: entryId },
        }))
      );
    }
  } catch (e) { console.warn("[timesheets:respondToFlag] Notification failed", e); }

  revalidatePath("/admin/timesheets");
  return { success: true };
}

// ── Export with paid_at marking ───────────────────────────────

export async function exportAndMarkPaid(formData: FormData) {
  const { supabase, user, profile, isAdmin, error: authError } = await requireAuth();
  if (authError || !user) return { error: authError ?? "Unauthorized" };
  if (!isAdmin) return { error: "Admin required" };

  const entryIds = JSON.parse(formData.get("entryIds") as string ?? "[]") as string[];
  if (entryIds.length === 0) return { error: "No entries to export." };

  const now = new Date().toISOString();
  await supabase.from("timesheet_entries").update({ paid_at: now }).in("id", entryIds).eq("status", "approved");

  const adminName = getAdminName(profile);
  for (const eid of entryIds) {
    try {
      await logChange(supabase, {
        tenantId: "", entryId: eid, changedBy: user.id, changedByName: adminName,
        changeType: "exported", note: `Exported ${now}`,
      });
    } catch {}
  }

  revalidatePath("/admin/timesheets");
  return { success: true, count: entryIds.length };
}
