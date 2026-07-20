import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET — post-checkout class details for the success page, with per-class pending-vs-waitlist status.
 * The session_id is the unguessable Stripe Checkout Session id (= enrollments.checkout_session_id),
 * so we read enrollments directly (service role) to surface the true status (§3.3).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ classes: [] });
  }

  const supabase = createAdminClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      status,
      class:classes(
        name, day_of_week, start_time, end_time,
        teacher:profiles!teacher_id(first_name, last_name)
      )
    `
    )
    .eq("checkout_session_id", sessionId);

  const classes = (enrollments ?? []).map((e) => {
    const cls = e.class as unknown as Record<string, unknown> | null;
    const teacherRaw = cls?.teacher as unknown;
    const teacher = (Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw) as {
      first_name: string;
      last_name: string;
    } | null;

    return {
      class_name: (cls?.name as string) ?? "",
      day_of_week: (cls?.day_of_week as number) ?? 0,
      start_time: (cls?.start_time as string) ?? "",
      end_time: (cls?.end_time as string) ?? "",
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
      waitlisted: e.status === "waitlist",
    };
  });

  return NextResponse.json({ classes });
}
