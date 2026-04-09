import { createAdminClient } from "@/lib/supabase/admin";

interface DetectedOpportunity {
  opportunity_type: string;
  title: string;
  description: string;
  action_label: string | null;
  action_url: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Detect real revenue/engagement opportunities for a student and upsert them
 * into student_opportunities. Uses createAdminClient. Idempotent — re-running
 * does not duplicate active rows of the same type for the same student.
 */
export async function detectAndUpsertOpportunities(
  tenantId: string,
  studentId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, active")
    .eq("id", studentId)
    .single();
  if (!student || !student.active) return;

  const detected: DetectedOpportunity[] = [];

  // ── 1. re_enrollment: no future-season enrollment ──
  const today = new Date().toISOString().split("T")[0];
  const { data: futureSeasons } = await supabase
    .from("seasons")
    .select("id, name, start_date")
    .eq("tenant_id", tenantId)
    .gte("start_date", today)
    .order("start_date")
    .limit(1);

  if (futureSeasons && futureSeasons.length > 0) {
    const nextSeason = futureSeasons[0];
    // Enrollments table has no season_id — join via classes.season_id
    const { data: nextSeasonEnrolls } = await supabase
      .from("enrollments")
      .select("id, classes!inner(season_id)")
      .eq("student_id", studentId)
      .eq("classes.season_id", nextSeason.id)
      .in("status", ["active", "trial"])
      .limit(1);

    if (!nextSeasonEnrolls || nextSeasonEnrolls.length === 0) {
      detected.push({
        opportunity_type: "re_enrollment",
        title: "Re-enrollment Due",
        description: `${nextSeason.name} enrollment not yet confirmed.`,
        action_label: "Send Placement Reminder",
        action_url: `/admin/students/${studentId}`,
        metadata: { season_id: nextSeason.id, season_name: nextSeason.name },
      });
    }
  }

  // ── 2. attendance_drop: <75% in last 30 days ──
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const thirtyAgoStr = thirtyAgo.toISOString().split("T")[0];

  const { data: recent } = await supabase
    .from("attendance_records")
    .select("status")
    .eq("student_id", studentId)
    .gte("date", thirtyAgoStr);

  if (recent && recent.length >= 4) {
    const present = recent.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    const rate = present / recent.length;
    if (rate < 0.75) {
      const pct = Math.round(rate * 100);
      detected.push({
        opportunity_type: "attendance_drop",
        title: "Attendance Drop",
        description: `${student.first_name}'s attendance is ${pct}% over the last 30 days.`,
        action_label: "Check in with family",
        action_url: `/admin/students/${studentId}`,
        metadata: { rate, sessions: recent.length },
      });
    }
  }

  // ── 3. private_recommended: teacher note mentions "private" ──
  const { data: flagged } = await supabase
    .from("attendance_records")
    .select("notes, teacher_id")
    .eq("student_id", studentId)
    .not("notes", "is", null)
    .ilike("notes", "%private%")
    .order("date", { ascending: false })
    .limit(1);

  if (flagged && flagged.length > 0) {
    detected.push({
      opportunity_type: "private_recommended",
      title: "Private Recommended",
      description: `A teacher noted ${student.first_name} would benefit from private instruction.`,
      action_label: "Book a Private",
      action_url: `/admin/privates?student=${studentId}`,
    });
  }

  if (detected.length === 0) return;

  // Find existing active rows of these types so we don't duplicate
  const types = detected.map((d) => d.opportunity_type);
  const { data: existing } = await supabase
    .from("student_opportunities")
    .select("opportunity_type")
    .eq("student_id", studentId)
    .eq("status", "active")
    .in("opportunity_type", types);

  const existingTypes = new Set((existing ?? []).map((e) => e.opportunity_type));
  const toInsert = detected
    .filter((d) => !existingTypes.has(d.opportunity_type))
    .map((d) => ({
      tenant_id: tenantId,
      student_id: studentId,
      opportunity_type: d.opportunity_type,
      title: d.title,
      description: d.description,
      action_label: d.action_label,
      action_url: d.action_url,
      metadata: d.metadata ?? {},
      status: "active",
    }));

  if (toInsert.length === 0) return;

  const { error } = await supabase
    .from("student_opportunities")
    .upsert(toInsert, {
      onConflict: "student_id,opportunity_type",
      ignoreDuplicates: true,
    });
  if (error) {
    console.error("[detectAndUpsertOpportunities] upsert failed:", error);
  }
}
