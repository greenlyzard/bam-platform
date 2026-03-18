import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Feature 5 — Late pickup alert.
 * Runs every 15 minutes during studio hours (3 PM – 9 PM Pacific, Mon–Sat).
 * Checks for classes that ended 10+ minutes ago where students were marked present
 * but not explicitly checked out. Sends notifications to admin and front desk.
 *
 * Since the attendance system uses a simple present/absent status (no checkout timestamp),
 * this cron checks for classes whose end_time + 10 minutes has passed today,
 * and where attendance was taken (students marked present) but no "checkout" note exists.
 *
 * NOTE: Full checkout tracking requires a checked_out_at column on attendance.
 * For now, this creates a notification reminding admin to verify pickup for classes
 * that ended 10+ minutes ago.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Current time in Pacific
  const now = new Date();
  const pacificTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const today = pacificTime.toISOString().split("T")[0];
  const currentHour = pacificTime.getHours();
  const currentMinute = pacificTime.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const todayDow = pacificTime.getDay();

  // Only run Mon–Sat (1–6), skip Sunday (0)
  if (todayDow === 0) {
    return NextResponse.json({ message: "Sunday — skipping." });
  }

  // Get classes that run today and have ended 10+ minutes ago
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, end_time, teacher_id")
    .eq("is_active", true)
    .eq("day_of_week", todayDow);

  if (!classes?.length) {
    return NextResponse.json({ message: "No classes today." });
  }

  // Filter to classes that ended 10+ minutes ago
  const alertClasses = classes.filter((c) => {
    if (!c.end_time) return false;
    const [h, m] = c.end_time.split(":").map(Number);
    const endMinutes = h * 60 + m;
    return currentTotalMinutes >= endMinutes + 10;
  });

  if (alertClasses.length === 0) {
    return NextResponse.json({ message: "No classes ended 10+ minutes ago." });
  }

  // Check which of these have attendance taken today with present students
  const classIds = alertClasses.map((c) => c.id);
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("class_id, student_id, status")
    .in("class_id", classIds)
    .eq("class_date", today)
    .in("status", ["present", "late"]);

  if (!attendanceRecords?.length) {
    return NextResponse.json({ message: "No present students to check." });
  }

  // Group by class
  const classPresentMap: Record<string, number> = {};
  for (const r of attendanceRecords) {
    classPresentMap[r.class_id] = (classPresentMap[r.class_id] ?? 0) + 1;
  }

  // Check if we already sent a late-pickup notification for these classes today
  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("metadata")
    .eq("notification_type", "late_pickup")
    .gte("created_at", today + "T00:00:00");

  const alreadyNotified = new Set<string>();
  for (const n of existingNotifs ?? []) {
    const meta = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
    if (meta?.class_id) alreadyNotified.add(meta.class_id);
  }

  // Filter to only classes we haven't already notified about
  const newAlerts = alertClasses.filter(
    (c) => classPresentMap[c.id] && !alreadyNotified.has(c.id)
  );

  if (newAlerts.length === 0) {
    return NextResponse.json({ message: "All alerts already sent." });
  }

  // Get admin and front desk profile IDs
  const { data: staffRoles } = await supabase
    .from("profile_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin", "front_desk"])
    .eq("is_active", true);

  const staffIds = [...new Set((staffRoles ?? []).map((r) => r.user_id))];
  if (staffIds.length === 0) {
    return NextResponse.json({ message: "No staff to notify." });
  }

  // Create notifications
  const notifications = [];
  for (const c of newAlerts) {
    const presentCount = classPresentMap[c.id] ?? 0;
    for (const staffId of staffIds) {
      notifications.push({
        recipient_id: staffId,
        notification_type: "late_pickup",
        title: `Late pickup: ${c.name}`,
        body: `${c.name} ended at ${formatTime12h(c.end_time!)} with ${presentCount} student${presentCount === 1 ? "" : "s"} checked in. Please verify all students have been picked up.`,
        metadata: JSON.stringify({
          class_id: c.id,
          class_name: c.name,
          date: today,
          present_count: presentCount,
        }),
      });
    }
  }

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }

  return NextResponse.json({
    message: `Sent ${newAlerts.length} late pickup alert(s) to ${staffIds.length} staff.`,
    classes: newAlerts.map((c) => c.name),
  });
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}
