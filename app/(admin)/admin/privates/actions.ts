"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Helpers (not exported)
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatTime12(t: string): string {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? "pm" : "am";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mm === "00" ? `${display}${suffix}` : `${display}:${mm}${suffix}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = DAY_NAMES[d.getDay()];
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${day} ${month} ${d.getDate()}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildSessionTitle(
  sessionType: string,
  studentNames: string[],
  teacherLastInitial: string,
  studio: string,
  sessionDate: string,
  startTime: string,
  endTime: string,
  isRecurring: boolean,
): string {
  const dateStr = formatDate(sessionDate);
  const timeRange = `${formatTime12(startTime)}\u2013${formatTime12(endTime)}`;
  const suffix = isRecurring ? " (recurring)" : "";
  const studioLabel = studio || "TBD";

  const type = (sessionType || "solo").toLowerCase();

  if (type === "pilates") {
    const name = studentNames[0] || "Student";
    return `${name} Pilates ${studioLabel} \u2014 ${dateStr} ${timeRange}${suffix}`;
  }

  if (type === "hybrid") {
    const names =
      studentNames.length <= 2
        ? studentNames.join(" & ")
        : `${studentNames.length} students`;
    return `${names} Hybrid ${studioLabel} \u2014 ${dateStr} ${timeRange}${suffix}`;
  }

  if (type === "duet" || (type === "solo" && studentNames.length === 2)) {
    return `${studentNames[0]} & ${studentNames[1]} duet ${studioLabel} \u2014 ${dateStr} ${timeRange}${suffix}`;
  }

  if (type === "group" || studentNames.length > 2) {
    return `Group ${studioLabel} \u2014 ${dateStr} ${timeRange} (${studentNames.length} students)${suffix}`;
  }

  // Default: solo
  const name = studentNames[0] || "Student";
  return `${name} ${teacherLastInitial} ${studioLabel} \u2014 ${dateStr} ${timeRange}${suffix}`;
}

async function postToPrivatesChannel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  session: {
    session_type: string;
    session_date: string;
    start_time: string;
    end_time: string;
    studio: string;
    is_recurring: boolean;
  },
  studentNames: string[],
  teacherLastInitial: string,
  authorId: string,
): Promise<void> {
  try {
    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", "%private%")
      .limit(1)
      .single();

    if (!channel) {
      console.warn("[privates:postToChannel] No privates channel found for tenant", tenantId);
      return;
    }

    const title = buildSessionTitle(
      session.session_type,
      studentNames,
      teacherLastInitial,
      session.studio,
      session.session_date,
      session.start_time,
      session.end_time,
      session.is_recurring,
    );

    await supabase.from("channel_posts").insert({
      channel_id: channel.id,
      author_id: authorId,
      title,
      body: null,
    });
  } catch (err) {
    console.warn("[privates:postToChannel] Skipped — channel post failed:", err);
  }
}

async function notifyTeachersOfPrivate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  sessionTitle: string,
  sessionId: string,
): Promise<void> {
  try {
    const { data: teachers } = await supabase
      .from("profile_roles")
      .select("user_id")
      .eq("role", "teacher")
      .eq("is_active", true);

    if (!teachers || teachers.length === 0) return;

    const notifications = teachers.map((t) => ({
      tenant_id: tenantId,
      recipient_id: t.user_id,
      notification_type: "private_lesson",
      title: sessionTitle,
      body: "A new private lesson has been scheduled.",
      metadata: { session_id: sessionId, tenant_id: tenantId },
      is_read: false,
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (err) {
    console.warn("[privates:notifyTeachers] Skipped — notification failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Billing helper: create billing rows + optional credit deduction
// ---------------------------------------------------------------------------

async function createBillingForSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  sessionId: string,
  studentIds: string[],
  sessionRate: number,
  marketRate: number | null,
): Promise<void> {
  const studentCount = studentIds.length;
  if (studentCount === 0) return;

  const splitPercentage = 100 / studentCount;

  for (const studentId of studentIds) {
    const amountOwed = sessionRate * splitPercentage / 100;
    const marketValue = marketRate ? marketRate * splitPercentage / 100 : null;
    const studioContribution =
      marketValue !== null && marketValue > amountOwed
        ? marketValue - amountOwed
        : 0;

    // Check credit balance (graceful)
    let hasCreditBalance = false;
    try {
      const { data: creditAccount } = await supabase
        .from("credit_accounts")
        .select("id, balance")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .gt("balance", 0)
        .limit(1)
        .single();

      if (creditAccount && creditAccount.balance >= amountOwed) {
        hasCreditBalance = true;
      }
    } catch {
      // credit_accounts table may not exist — skip
    }

    // Check unlimited plan (graceful)
    let hasUnlimitedPlan = false;
    if (!hasCreditBalance) {
      try {
        const { data: plan } = await supabase
          .from("unlimited_plans")
          .select("id")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (plan) {
          hasUnlimitedPlan = true;
        }
      } catch {
        // unlimited_plans table may not exist — skip
      }
    }

    let billingStatus: string;
    if (hasCreditBalance) {
      billingStatus = "deducted_from_pack";
    } else if (hasUnlimitedPlan) {
      billingStatus = "waived";
    } else {
      billingStatus = "pending";
    }

    // Look up family_id (graceful)
    let familyId: string | null = null;
    try {
      const { data: student } = await supabase
        .from("students")
        .select("family_id")
        .eq("id", studentId)
        .single();

      if (student) {
        familyId = student.family_id;
      }
    } catch {
      // skip
    }

    const { error: billingErr } = await supabase
      .from("private_session_billing")
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        student_id: studentId,
        family_id: familyId,
        split_percentage: splitPercentage,
        amount_owed: amountOwed,
        market_value: marketValue,
        studio_contribution: studioContribution > 0 ? studioContribution : 0,
        billing_status: billingStatus,
      });

    if (billingErr) {
      console.error("[privates:billing:insert]", billingErr);
    }

    // Deduct credits if applicable
    if (billingStatus === "deducted_from_pack") {
      try {
        // Decrement balance
        const { data: creditAccount } = await supabase
          .from("credit_accounts")
          .select("id, balance")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .gt("balance", 0)
          .limit(1)
          .single();

        if (creditAccount) {
          await supabase
            .from("credit_accounts")
            .update({
              balance: creditAccount.balance - amountOwed,
              updated_at: new Date().toISOString(),
            })
            .eq("id", creditAccount.id);

          // Record the transaction
          await supabase.from("credit_transactions").insert({
            tenant_id: tenantId,
            credit_account_id: creditAccount.id,
            student_id: studentId,
            amount: -amountOwed,
            transaction_type: "deduction",
            description: `Private session ${sessionId}`,
            reference_type: "private_session",
            reference_id: sessionId,
          });
        }
      } catch (err) {
        console.warn("[privates:billing:creditDeduct] Skipped:", err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Exported server actions
// ---------------------------------------------------------------------------

export async function createPrivateSession(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  if (!tenantId) return { error: "Missing tenant" };

  // Parse fields
  const sessionType = (formData.get("session_type") as string) || "solo";
  const sessionDate = formData.get("session_date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const durationMinutes = parseInt(formData.get("duration_minutes") as string, 10) || null;
  const studio = (formData.get("studio") as string) || null;
  const locationNotes = (formData.get("location_notes") as string) || null;
  const primaryTeacherId = formData.get("primary_teacher_id") as string;
  const sessionRate = parseFloat(formData.get("session_rate") as string) || 0;
  const billingModel = (formData.get("billing_model") as string) || null;
  const billingStatus = (formData.get("billing_status") as string) || null;
  const marketRateRaw = formData.get("market_rate") as string;
  const marketRate = marketRateRaw ? parseFloat(marketRateRaw) : null;
  const studioContribution = formData.get("studio_contribution")
    ? parseFloat(formData.get("studio_contribution") as string)
    : null;
  const contributionNote = (formData.get("contribution_note") as string) || null;
  const isRecurring = formData.get("is_recurring") === "true";
  const recurrenceRule = (formData.get("recurrence_rule") as string) || null;
  const bookingSource = (formData.get("booking_source") as string) || "admin";
  const availabilitySlotId = (formData.get("availability_slot_id") as string) || null;
  const sessionNotes = (formData.get("session_notes") as string) || null;
  const parentVisibleNotes = (formData.get("parent_visible_notes") as string) || null;

  let studentIds: string[] = [];
  try {
    const raw = formData.get("student_ids") as string;
    studentIds = raw ? JSON.parse(raw) : [];
  } catch {
    return { error: "Invalid student_ids format" };
  }

  let coTeacherIds: string[] = [];
  try {
    const raw = formData.get("co_teacher_ids") as string;
    coTeacherIds = raw ? JSON.parse(raw) : [];
  } catch {
    coTeacherIds = [];
  }

  if (!sessionDate || !startTime || !endTime) {
    return { error: "Date and times are required" };
  }
  if (!primaryTeacherId) {
    return { error: "Primary teacher is required" };
  }
  if (studentIds.length === 0) {
    return { error: "At least one student is required" };
  }

  const icalUid = randomUUID();

  // Insert primary session
  const { data: session, error: sessionErr } = await supabase
    .from("private_sessions")
    .insert({
      tenant_id: tenantId,
      session_type: sessionType,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      studio,
      location_notes: locationNotes,
      student_ids: studentIds,
      primary_teacher_id: primaryTeacherId,
      co_teacher_ids: coTeacherIds.length > 0 ? coTeacherIds : null,
      session_rate: sessionRate,
      billing_model: billingModel,
      billing_status: billingStatus,
      market_rate: marketRate,
      studio_contribution: studioContribution,
      contribution_note: contributionNote,
      is_recurring: isRecurring,
      recurrence_rule: recurrenceRule,
      recurrence_parent_id: null,
      status: "scheduled",
      booking_source: bookingSource,
      availability_slot_id: availabilitySlotId,
      session_notes: sessionNotes,
      parent_visible_notes: parentVisibleNotes,
      ical_uid: icalUid,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sessionErr) {
    console.error("[privates:create]", sessionErr);
    return { error: sessionErr.message };
  }

  // Create billing rows for primary session
  await createBillingForSession(
    supabase,
    tenantId,
    session.id,
    studentIds,
    sessionRate,
    marketRate,
  );

  // -------------------------------------------------------------------------
  // Recurring instances (up to 12 future sessions)
  // -------------------------------------------------------------------------
  if (isRecurring && recurrenceRule) {
    const increment = recurrenceRule.toLowerCase().includes("biweekly")
      || recurrenceRule.toLowerCase().includes("bi-weekly")
      ? 14
      : 7;

    for (let i = 1; i <= 12; i++) {
      const futureDate = addDays(sessionDate, increment * i);
      const futureIcalUid = randomUUID();

      const { data: recurringSes, error: recurErr } = await supabase
        .from("private_sessions")
        .insert({
          tenant_id: tenantId,
          session_type: sessionType,
          session_date: futureDate,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: durationMinutes,
          studio,
          location_notes: locationNotes,
          student_ids: studentIds,
          primary_teacher_id: primaryTeacherId,
          co_teacher_ids: coTeacherIds.length > 0 ? coTeacherIds : null,
          session_rate: sessionRate,
          billing_model: billingModel,
          billing_status: billingStatus,
          market_rate: marketRate,
          studio_contribution: studioContribution,
          contribution_note: contributionNote,
          is_recurring: true,
          recurrence_rule: recurrenceRule,
          recurrence_parent_id: session.id,
          status: "scheduled",
          booking_source: bookingSource,
          availability_slot_id: availabilitySlotId,
          session_notes: sessionNotes,
          parent_visible_notes: parentVisibleNotes,
          ical_uid: futureIcalUid,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (recurErr) {
        console.error(`[privates:recurring:${i}]`, recurErr);
        continue;
      }

      await createBillingForSession(
        supabase,
        tenantId,
        recurringSes.id,
        studentIds,
        sessionRate,
        marketRate,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Resolve student names and teacher initial for feed + notifications
  // -------------------------------------------------------------------------
  let studentNames: string[] = [];
  let teacherLastInitial = "";

  try {
    const { data: students } = await supabase
      .from("students")
      .select("first_name, last_name")
      .in("id", studentIds);

    if (students) {
      studentNames = students.map(
        (s) => s.first_name || s.last_name || "Student",
      );
    }
  } catch {
    studentNames = studentIds.map(() => "Student");
  }

  try {
    const { data: teacher } = await supabase
      .from("profiles")
      .select("last_name")
      .eq("id", primaryTeacherId)
      .single();

    if (teacher?.last_name) {
      teacherLastInitial = teacher.last_name.charAt(0).toUpperCase();
    }
  } catch {
    teacherLastInitial = "";
  }

  // Post to privates channel
  await postToPrivatesChannel(
    supabase,
    tenantId,
    {
      session_type: sessionType,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      studio: studio || "",
      is_recurring: isRecurring,
    },
    studentNames,
    teacherLastInitial,
    user.id,
  );

  // Notify teachers
  const title = buildSessionTitle(
    sessionType,
    studentNames,
    teacherLastInitial,
    studio || "",
    sessionDate,
    startTime,
    endTime,
    isRecurring,
  );
  await notifyTeachersOfPrivate(supabase, tenantId, title, session.id);

  revalidatePath("/admin/privates");
  revalidatePath("/teach/privates");

  return { id: session.id };
}

// ---------------------------------------------------------------------------
// cancelPrivateSession
// ---------------------------------------------------------------------------

export async function cancelPrivateSession(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sessionId = formData.get("session_id") as string;
  if (!sessionId) return { error: "Missing session_id" };

  const cancellationReason = (formData.get("cancellation_reason") as string) || null;

  const { error } = await supabase
    .from("private_sessions")
    .update({
      status: "cancelled",
      cancellation_reason: cancellationReason,
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[privates:cancel]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/privates");
  revalidatePath("/teach/privates");
  return {};
}

// ---------------------------------------------------------------------------
// updatePrivateSessionStatus
// ---------------------------------------------------------------------------

export async function updatePrivateSessionStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sessionId = formData.get("session_id") as string;
  const status = formData.get("status") as string;

  if (!sessionId) return { error: "Missing session_id" };
  if (!status) return { error: "Missing status" };

  const { error } = await supabase
    .from("private_sessions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[privates:updateStatus]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/privates");
  revalidatePath("/teach/privates");
  return {};
}
