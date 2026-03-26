"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function confirmPrivateSession(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) return { error: "Missing session ID" };

  // Verify ownership
  const { data: session } = await supabase
    .from("private_sessions")
    .select("id, primary_teacher_id, student_ids, session_date, start_time")
    .eq("id", sessionId)
    .single();

  if (!session || session.primary_teacher_id !== user.id) {
    return { error: "Session not found or unauthorized" };
  }

  const { error } = await supabase
    .from("private_sessions")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // Notify parent (via student → family → guardian)
  try {
    const studentIds = (session.student_ids as string[]) ?? [];
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("parent_id, first_name")
        .in("id", studentIds);

      const { data: teacher } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();

      const parentIds = [...new Set((students ?? []).map((s) => s.parent_id).filter(Boolean))];
      if (parentIds.length > 0) {
        const studentName = students?.[0]?.first_name ?? "Your child";
        const teacherName = teacher?.first_name ?? "Your teacher";
        await supabase.from("notifications").insert(
          parentIds.map((pid) => ({
            recipient_id: pid,
            notification_type: "private_lesson",
            title: "Private lesson confirmed",
            body: `Your private lesson with ${teacherName} on ${session.session_date} at ${session.start_time} has been confirmed!`,
            metadata: { session_id: sessionId },
          }))
        );
      }
    }
  } catch (e) {
    console.warn("[privates:confirm] Notification failed", e);
  }

  revalidatePath("/teach/privates");
  return {};
}

export async function declinePrivateSession(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) return { error: "Missing session ID" };

  const { data: session } = await supabase
    .from("private_sessions")
    .select("id, primary_teacher_id, availability_slot_id, student_ids, session_date, start_time")
    .eq("id", sessionId)
    .single();

  if (!session || session.primary_teacher_id !== user.id) {
    return { error: "Session not found or unauthorized" };
  }

  // Cancel the session
  const { error } = await supabase
    .from("private_sessions")
    .update({
      status: "cancelled",
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Teacher declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // Release the availability slot
  if (session.availability_slot_id) {
    await supabase
      .from("teacher_availability")
      .update({ is_booked: false })
      .eq("id", session.availability_slot_id);
  }

  // Notify parent
  try {
    const studentIds = (session.student_ids as string[]) ?? [];
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("parent_id, first_name")
        .in("id", studentIds);

      const { data: teacher } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();

      const parentIds = [...new Set((students ?? []).map((s) => s.parent_id).filter(Boolean))];
      if (parentIds.length > 0) {
        const teacherName = teacher?.first_name ?? "Your teacher";
        await supabase.from("notifications").insert(
          parentIds.map((pid) => ({
            recipient_id: pid,
            notification_type: "private_lesson",
            title: "Private lesson declined",
            body: `Unfortunately ${teacherName} is unable to make your requested time on ${session.session_date}. Please book another slot.`,
            metadata: { session_id: sessionId },
          }))
        );
      }
    }
  } catch (e) {
    console.warn("[privates:decline] Notification failed", e);
  }

  revalidatePath("/teach/privates");
  return {};
}
