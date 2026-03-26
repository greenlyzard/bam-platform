import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PrivatesClient } from "./privates-client";

export default async function AdminPrivatesPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // 1. Fetch all private sessions for the tenant
  const { data: sessionRows } = await supabase
    .from("private_sessions")
    .select(
      "id, session_type, session_date, start_time, end_time, duration_minutes, studio, student_ids, primary_teacher_id, status, billing_status, billing_model, is_recurring, session_rate"
    )
    .eq("tenant_id", user.tenantId)
    .order("session_date", { ascending: false })
    .order("start_time", { ascending: true });

  const sessions = sessionRows ?? [];

  // 2. Fetch teacher names for all referenced teacher IDs
  const teacherIds = [
    ...new Set(
      sessions
        .map((s) => s.primary_teacher_id)
        .filter(Boolean) as string[]
    ),
  ];

  const teacherMap: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: teacherRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);

    for (const t of teacherRows ?? []) {
      teacherMap[t.id] = [t.first_name, t.last_name]
        .filter(Boolean)
        .join(" ") || "Unknown";
    }
  }

  // 3. Fetch student names for all referenced student IDs
  const allStudentIds = [
    ...new Set(sessions.flatMap((s) => s.student_ids ?? [])),
  ];

  const studentMap: Record<string, string> = {};
  if (allStudentIds.length > 0) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .in("id", allStudentIds);

    for (const s of studentRows ?? []) {
      studentMap[s.id] = s.first_name || "Unknown";
    }
  }

  // 4. Fetch billing summaries per session
  const sessionIds = sessions.map((s) => s.id);
  const billingMap: Record<string, { pending: number; paid: number }> = {};

  if (sessionIds.length > 0) {
    const { data: billingRows } = await supabase
      .from("private_session_billing")
      .select("session_id, billing_status")
      .in("session_id", sessionIds);

    for (const b of billingRows ?? []) {
      if (!billingMap[b.session_id]) {
        billingMap[b.session_id] = { pending: 0, paid: 0 };
      }
      if (b.billing_status === "paid") {
        billingMap[b.session_id].paid += 1;
      } else {
        billingMap[b.session_id].pending += 1;
      }
    }
  }

  // 5. Fetch teacher list for filter dropdown
  const { data: teacherProfileRows } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("first_name");

  const teachers = (teacherProfileRows ?? []).map((tp) => ({
    id: tp.id,
    name: [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
  }));

  // 6. Compute stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const thisWeek = sessions.filter(
    (s) => s.session_date >= weekStartStr && s.session_date <= weekEndStr
  ).length;

  const pendingBilling = sessions.filter(
    (s) => s.billing_status === "pending"
  ).length;

  const thisMonth = sessions.filter(
    (s) => s.session_date >= monthStart && s.session_date <= monthEnd
  ).length;

  return (
    <PrivatesClient
      sessions={sessions}
      teacherMap={teacherMap}
      studentMap={studentMap}
      billingMap={billingMap}
      teachers={teachers}
      stats={{
        thisWeek,
        pendingBilling,
        thisMonth,
      }}
    />
  );
}
