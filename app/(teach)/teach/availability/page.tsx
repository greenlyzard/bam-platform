import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityClient } from "./availability-client";

export default async function TeacherAvailabilityPage() {
  const user = await requireRole("teacher", "admin", "super_admin");
  const supabase = await createClient();

  // Fetch this teacher's availability slots
  const { data: slots } = await supabase
    .from("teacher_availability")
    .select(
      "id, tenant_id, teacher_id, day_of_week, specific_date, start_time, end_time, is_recurring, slot_type, max_students, is_published, is_booked, created_at"
    )
    .eq("teacher_id", user.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  // Try to fetch auto-confirm preference (graceful if table missing)
  let autoConfirm = false;
  try {
    const { data: pref } = await supabase
      .from("teacher_preferences")
      .select("auto_confirm_bookings")
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (pref) autoConfirm = pref.auto_confirm_bookings ?? false;
  } catch {
    // teacher_preferences table may not exist yet
  }

  return (
    <AvailabilityClient
      slots={slots ?? []}
      autoConfirmDefault={autoConfirm}
    />
  );
}
