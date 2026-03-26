import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getMyStudents } from "@/lib/queries/portal";
import { ParentPrivatesClient } from "./parent-privates-client";

export default async function ParentPrivatesPage() {
  const user = await requireParent();
  const supabase = await createClient();

  // ── Fetch family students ──────────────────────────────────────
  const students = await getMyStudents();
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Private Lessons
          </h1>
        </div>
        <div className="rounded-xl border border-silver bg-white p-8 text-center">
          <p className="text-sm text-slate">
            No private sessions yet. Book your first private lesson.
          </p>
        </div>
      </div>
    );
  }

  // ── Fetch private sessions for family students ─────────────────
  const { data: allSessions } = await supabase
    .from("private_sessions")
    .select(
      "id, session_type, session_date, start_time, end_time, duration_minutes, studio, student_ids, primary_teacher_id, status, booking_source, is_recurring, parent_visible_notes"
    )
    .in("status", ["scheduled", "completed", "cancelled"]);

  // Filter to sessions that overlap with this family's students
  const sessions = (allSessions ?? []).filter((s) =>
    (s.student_ids ?? []).some((sid: string) => studentIds.includes(sid))
  );

  const sessionIds = sessions.map((s) => s.id);

  // ── Fetch billing rows for matching sessions ───────────────────
  let billing: Array<{
    id: string;
    session_id: string;
    student_id: string;
    amount_owed: number | null;
    market_value: number | null;
    studio_contribution: number | null;
    teacher_contribution_note: string | null;
    billing_status: string;
    payment_method: string | null;
  }> = [];

  if (sessionIds.length > 0) {
    const { data: billingRows } = await supabase
      .from("private_session_billing")
      .select(
        "id, session_id, student_id, amount_owed, market_value, studio_contribution, teacher_contribution_note, billing_status, payment_method"
      )
      .in("session_id", sessionIds);

    billing = billingRows ?? [];
  }

  // ── Fetch teacher names ────────────────────────────────────────
  const teacherIds = [
    ...new Set(sessions.map((s) => s.primary_teacher_id).filter(Boolean)),
  ] as string[];

  const teacherMap: Record<string, string> = {};

  if (teacherIds.length > 0) {
    const { data: teacherRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);

    for (const t of teacherRows ?? []) {
      teacherMap[t.id] = [t.first_name, t.last_name].filter(Boolean).join(" ");
    }
  }

  // ── Build student map ──────────────────────────────────────────
  const studentMap: Record<string, string> = {};
  for (const s of students) {
    studentMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ");
  }

  // ── Fetch studio contribution visibility setting ───────────────
  let showContribution = false;
  try {
    const { data: settings } = await supabase
      .from("tenant_billing_settings")
      .select("show_studio_contribution")
      .eq("tenant_id", user.tenantId!)
      .single();

    showContribution = settings?.show_studio_contribution ?? false;
  } catch {
    // Gracefully default to hidden
  }

  return (
    <div className="space-y-8">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Private Lessons
        </h1>
        <p className="mt-1 text-sm text-slate">
          View your family&apos;s private lesson history and upcoming sessions.
        </p>
      </div>

      <ParentPrivatesClient
        sessions={sessions}
        billing={billing}
        teacherMap={teacherMap}
        studentMap={studentMap}
        showContribution={showContribution}
      />
    </div>
  );
}
