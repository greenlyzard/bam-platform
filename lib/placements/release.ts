import { createAdminClient } from "@/lib/supabase/admin";
import { sendRawEmail } from "@/lib/email/send";

/**
 * Execute a season placement release: update staged → released,
 * notify families via push + email, and log the release event.
 *
 * Used by both:
 *   - POST /api/admin/placements/release (manual immediate release)
 *   - POST /api/cron/process-scheduled-releases (scheduled releases)
 *
 * @param seasonId       Season UUID
 * @param tenantId       Tenant UUID
 * @param releasedBy     Profile ID of the releaser (or null for cron)
 * @param logEvent       Whether to insert a season_placement_releases row
 *                       (set false when called from cron — caller updates
 *                       the existing scheduled row instead)
 */
export async function executePlacementRelease(opts: {
  seasonId: string;
  tenantId: string;
  releasedBy: string | null;
  logEvent: boolean;
}): Promise<{
  released: number;
  studentsPlaced: number;
  familiesNotified: number;
  emailsSent: number;
}> {
  const { seasonId, tenantId, releasedBy, logEvent } = opts;
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Fetch season name
  const { data: season } = await supabase
    .from("seasons")
    .select("name")
    .eq("id", seasonId)
    .single();
  const seasonName = season?.name ?? "next season";

  // Fetch staged placements
  const { data: stagedRows } = await supabase
    .from("season_placements")
    .select("id, student_id")
    .eq("season_id", seasonId)
    .eq("status", "staged");

  const stagedIds = (stagedRows ?? []).map((r) => r.id);
  const studentIds = Array.from(new Set((stagedRows ?? []).map((r) => r.student_id)));

  if (stagedIds.length === 0) {
    return { released: 0, studentsPlaced: 0, familiesNotified: 0, emailsSent: 0 };
  }

  // Update placements
  await supabase
    .from("season_placements")
    .update({ status: "released", released_at: nowIso, updated_at: nowIso })
    .in("id", stagedIds);

  // Fetch student → parent/family
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, parent_id, family_id")
    .in("id", studentIds);

  const byParent = new Map<
    string,
    { studentNames: string[]; studentIds: string[]; familyId: string | null }
  >();
  for (const s of students ?? []) {
    if (!s.parent_id) continue;
    if (!byParent.has(s.parent_id)) {
      byParent.set(s.parent_id, { studentNames: [], studentIds: [], familyId: s.family_id });
    }
    const entry = byParent.get(s.parent_id)!;
    entry.studentNames.push(s.first_name);
    entry.studentIds.push(s.id);
    if (!entry.familyId && s.family_id) entry.familyId = s.family_id;
  }

  const parentIds = Array.from(byParent.keys());

  const { data: parents } = parentIds.length
    ? await supabase.from("profiles").select("id, email, first_name").in("id", parentIds)
    : { data: [] };
  const parentMap = new Map<string, { email: string | null; first_name: string | null }>();
  for (const p of parents ?? []) parentMap.set(p.id, { email: p.email, first_name: p.first_name });

  const familyIds = Array.from(
    new Set(Array.from(byParent.values()).map((e) => e.familyId).filter(Boolean) as string[])
  );
  const { data: families } = familyIds.length
    ? await supabase.from("families").select("id, billing_email").in("id", familyIds)
    : { data: [] };
  const familyEmailMap = new Map<string, string | null>();
  for (const f of families ?? []) familyEmailMap.set(f.id, f.billing_email);

  // Push notifications
  const notificationRows = parentIds.map((parentId) => {
    const entry = byParent.get(parentId)!;
    const namesStr = entry.studentNames.join(" and ");
    return {
      tenant_id: tenantId,
      recipient_id: parentId,
      notification_type: "placement_released",
      title: `Your ${seasonName} classes are ready to review`,
      body: `Miss Amanda has recommended classes for ${namesStr}. Log in to review and confirm.`,
      metadata: { season_id: seasonId, student_ids: entry.studentIds },
    };
  });

  if (notificationRows.length > 0) {
    const { error: notifErr } = await supabase.from("notifications").insert(notificationRows);
    if (notifErr) console.error("[placement:release] notification insert failed:", notifErr.message);
  }

  // Emails
  let emailsSent = 0;
  for (const parentId of parentIds) {
    const parent = parentMap.get(parentId);
    const entry = byParent.get(parentId)!;
    const billingEmail = entry.familyId ? familyEmailMap.get(entry.familyId) ?? null : null;
    const toEmail = billingEmail ?? parent?.email ?? null;
    if (!toEmail) continue;

    const namesStr = entry.studentNames.join(" and ");
    const greeting = parent?.first_name ? `Hi ${parent.first_name},` : "Hi there,";

    try {
      await sendRawEmail({
        to: toEmail,
        subject: `Your ${seasonName} classes are ready to review`,
        bodyHtml: `
          <p>${greeting}</p>
          <p>Miss Amanda has recommended classes for <strong>${namesStr}</strong> for ${seasonName}.</p>
          <p>Log in to your portal to review the recommendations and confirm enrollment.</p>
          <p style="margin-top: 24px;">
            <a href="https://portal.balletacademyandmovement.com/portal/dashboard"
               style="background:#9C8BBF;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Review Recommendations
            </a>
          </p>
          <p style="color:#6B5A99;font-size:14px;margin-top:24px;">
            Questions? Reply to this email or call us at (949) 229-0846.
          </p>
        `,
      });
      emailsSent++;
    } catch (e) {
      console.error(`[placement:release] email failed for parent ${parentId}:`, e);
    }
  }

  // Log the release event (only for immediate releases — cron updates existing row)
  if (logEvent) {
    await supabase.from("season_placement_releases").insert({
      tenant_id: tenantId,
      season_id: seasonId,
      released_by: releasedBy,
      executed_at: nowIso,
      families_notified: parentIds.length,
      students_placed: studentIds.length,
    });
  }

  return {
    released: stagedIds.length,
    studentsPlaced: studentIds.length,
    familiesNotified: parentIds.length,
    emailsSent,
  };
}
