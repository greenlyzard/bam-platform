"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function formatTime12(t: string): string {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? "pm" : "am";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mm === "00" ? `${display}${suffix}` : `${display}:${mm}${suffix}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${DAY_NAMES[d.getDay()]} ${month} ${d.getDate()}`;
}

/** Map slot_type to private_sessions session_type */
function mapSlotType(slotType: string): string {
  if (slotType === "pilates") return "pilates";
  return "solo"; // 'private' and 'any' both map to solo
}

/** Calculate the next occurrence of a day_of_week from today, within 4 weeks */
function nextOccurrence(dayOfWeek: number): string {
  const today = new Date();
  const todayDow = today.getDay();
  let daysUntil = dayOfWeek - todayDow;
  if (daysUntil <= 0) daysUntil += 7;
  const next = new Date(today);
  next.setDate(next.getDate() + daysUntil);
  return next.toISOString().slice(0, 10);
}

/** Calculate duration in minutes between two HH:MM:SS or HH:MM time strings */
function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ---------------------------------------------------------------------------
// bookPrivateSession — parent self-booking action
// ---------------------------------------------------------------------------

export async function bookPrivateSession(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  const studentId = formData.get("student_id") as string;
  const teacherId = formData.get("teacher_id") as string;
  const slotId = formData.get("slot_id") as string;

  if (!tenantId || !studentId || !teacherId || !slotId) {
    return { error: "Missing required booking fields." };
  }

  // ── Fetch the availability slot ──────────────────────────────
  const { data: slot, error: slotErr } = await supabase
    .from("teacher_availability")
    .select(
      "id, teacher_id, day_of_week, specific_date, start_time, end_time, is_recurring, slot_type, is_booked, is_published"
    )
    .eq("id", slotId)
    .single();

  if (slotErr || !slot) {
    return { error: "Slot not found." };
  }

  // ── Guard: slot must still be available ──────────────────────
  if (slot.is_booked) {
    return { error: "This time slot has already been booked. Please choose another." };
  }

  if (!slot.is_published) {
    return { error: "This slot is no longer available." };
  }

  // ── Determine session date ───────────────────────────────────
  const sessionDate = slot.specific_date
    ? slot.specific_date
    : nextOccurrence(slot.day_of_week);

  const durationMinutes = calcDuration(slot.start_time, slot.end_time);
  const sessionType = mapSlotType(slot.slot_type);

  // ── Check teacher auto-confirm preference ────────────────────
  let autoConfirm = false;
  try {
    const { data: pref } = await supabase
      .from("teacher_preferences")
      .select("auto_confirm_bookings")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (pref?.auto_confirm_bookings) {
      autoConfirm = true;
    }
  } catch {
    // teacher_preferences table may not exist yet — default to manual
  }

  const initialStatus = autoConfirm ? "confirmed" : "scheduled";

  // ── Resolve names for notifications ──────────────────────────
  let studentName = "Student";
  let teacherName = "Teacher";
  try {
    const { data: student } = await supabase
      .from("students")
      .select("first_name, last_name, family_id")
      .eq("id", studentId)
      .single();
    if (student) {
      studentName = [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student";
    }
  } catch { /* skip */ }

  try {
    const { data: teacher } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", teacherId)
      .single();
    if (teacher) {
      teacherName = [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || "Teacher";
    }
  } catch { /* skip */ }

  // ── Insert private session ───────────────────────────────────
  const icalUid = randomUUID();

  const { data: session, error: sessionErr } = await supabase
    .from("private_sessions")
    .insert({
      tenant_id: tenantId,
      session_type: sessionType,
      session_date: sessionDate,
      start_time: slot.start_time,
      end_time: slot.end_time,
      duration_minutes: durationMinutes,
      student_ids: [studentId],
      primary_teacher_id: teacherId,
      status: initialStatus,
      booking_source: "parent",
      availability_slot_id: slotId,
      ical_uid: icalUid,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sessionErr) {
    console.error("[book-private:create]", sessionErr);
    return { error: "Failed to create booking. Please try again." };
  }

  // ── Mark slot as booked ──────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("teacher_availability")
    .update({ is_booked: true })
    .eq("id", slotId);

  if (updateErr) {
    console.error("[book-private:markBooked]", updateErr);
  }

  // ── Create billing record ────────────────────────────────────
  try {
    let familyId: string | null = null;
    const { data: studentRow } = await supabase
      .from("students")
      .select("family_id")
      .eq("id", studentId)
      .single();
    if (studentRow) familyId = studentRow.family_id;

    await supabase.from("private_session_billing").insert({
      tenant_id: tenantId,
      session_id: session.id,
      student_id: studentId,
      family_id: familyId,
      billing_status: "pending",
      split_percentage: 100,
    });
  } catch (err) {
    console.warn("[book-private:billing] Skipped:", err);
  }

  // ── Notify teacher ───────────────────────────────────────────
  const dateLabel = formatDate(sessionDate);
  const timeLabel = `${formatTime12(slot.start_time)}\u2013${formatTime12(slot.end_time)}`;

  try {
    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      recipient_id: teacherId,
      notification_type: "private_lesson",
      title: `${studentName} has requested a private on ${dateLabel}`,
      body: `${dateLabel} at ${timeLabel}. Please confirm in your portal.`,
      metadata: { session_id: session.id, tenant_id: tenantId },
      is_read: false,
    });
  } catch (err) {
    console.warn("[book-private:notifyTeacher] Skipped:", err);
  }

  // ── If auto-confirmed, notify parent ─────────────────────────
  if (autoConfirm) {
    try {
      await supabase.from("notifications").insert({
        tenant_id: tenantId,
        recipient_id: user.id,
        notification_type: "private_lesson",
        title: `Your private with ${teacherName} has been confirmed`,
        body: `${dateLabel} at ${timeLabel}. See you at the studio!`,
        metadata: { session_id: session.id, tenant_id: tenantId },
        is_read: false,
      });
    } catch (err) {
      console.warn("[book-private:notifyParent] Skipped:", err);
    }
  }

  // ── Revalidate ───────────────────────────────────────────────
  revalidatePath("/portal/book-private");
  revalidatePath("/portal/dashboard");
  revalidatePath("/teach/privates");
  revalidatePath("/teach/availability");

  return { id: session.id, status: initialStatus };
}
