import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRawEmail } from "@/lib/email/send";

export async function POST(req: Request) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { season_id, action, scheduled_for } = body ?? {};

  if (!season_id || (action !== "stage" && action !== "release" && action !== "schedule")) {
    return NextResponse.json(
      { error: "season_id and action ('stage'|'release'|'schedule') are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (action === "stage") {
    const { count } = await supabase
      .from("season_placements")
      .select("id", { count: "exact", head: true })
      .eq("season_id", season_id)
      .eq("status", "staged");
    return NextResponse.json({ message: `${count ?? 0} placements staged` });
  }

  if (action === "schedule") {
    if (!scheduled_for) {
      return NextResponse.json({ error: "scheduled_for is required" }, { status: 400 });
    }
    await supabase.from("season_placement_releases").insert({
      tenant_id: user.tenantId!,
      season_id,
      released_by: user.id,
      scheduled_for,
    });
    return NextResponse.json({
      message: `Release scheduled for ${new Date(scheduled_for).toLocaleString()}`,
    });
  }

  // action === "release"
  const nowIso = new Date().toISOString();

  // Fetch season name for notification copy
  const { data: season } = await supabase
    .from("seasons")
    .select("name")
    .eq("id", season_id)
    .single();
  const seasonName = season?.name ?? "next season";

  // Fetch staged placements with student info
  const { data: stagedRows, error: fetchErr } = await supabase
    .from("season_placements")
    .select("id, student_id")
    .eq("season_id", season_id)
    .eq("status", "staged");

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const stagedIds = (stagedRows ?? []).map((r) => r.id);
  const studentIds = Array.from(new Set((stagedRows ?? []).map((r) => r.student_id)));

  if (stagedIds.length === 0) {
    return NextResponse.json({ message: "No staged placements to release" });
  }

  // Update placements to released
  const { error: updateErr } = await supabase
    .from("season_placements")
    .update({ status: "released", released_at: nowIso, updated_at: nowIso })
    .in("id", stagedIds);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Fetch student → parent/family mapping
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, parent_id, family_id")
    .in("id", studentIds);

  // Group students by parent_id
  const byParent = new Map<string, { studentNames: string[]; studentIds: string[]; familyId: string | null }>();
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

  // Fetch parent profiles
  const { data: parents } = parentIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, first_name")
        .in("id", parentIds)
    : { data: [] };
  const parentMap = new Map<string, { email: string | null; first_name: string | null }>();
  for (const p of parents ?? []) {
    parentMap.set(p.id, { email: p.email, first_name: p.first_name });
  }

  // Fetch family billing emails (preferred over profile email)
  const familyIds = Array.from(
    new Set(Array.from(byParent.values()).map((e) => e.familyId).filter(Boolean) as string[])
  );
  const { data: families } = familyIds.length
    ? await supabase
        .from("families")
        .select("id, billing_email")
        .in("id", familyIds)
    : { data: [] };
  const familyEmailMap = new Map<string, string | null>();
  for (const f of families ?? []) {
    familyEmailMap.set(f.id, f.billing_email);
  }

  // Build push notifications
  const notificationRows = parentIds.map((parentId) => {
    const entry = byParent.get(parentId)!;
    const namesStr = entry.studentNames.join(" and ");
    return {
      tenant_id: user.tenantId!,
      recipient_id: parentId,
      notification_type: "placement_released",
      title: `Your ${seasonName} classes are ready to review`,
      body: `Miss Amanda has recommended classes for ${namesStr}. Log in to review and confirm.`,
      metadata: { season_id, student_ids: entry.studentIds },
    };
  });

  if (notificationRows.length > 0) {
    const { error: notifErr } = await supabase.from("notifications").insert(notificationRows);
    if (notifErr) {
      console.error("[placement:release] notification insert failed:", notifErr.message);
    }
  }

  // Send emails to parents — prefer family billing_email, fall back to profile email
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

  // Log the release event
  await supabase.from("season_placement_releases").insert({
    tenant_id: user.tenantId!,
    season_id,
    released_by: user.id,
    executed_at: nowIso,
    families_notified: parentIds.length,
    students_placed: studentIds.length,
  });

  return NextResponse.json({
    message: `Released ${stagedIds.length} placements for ${studentIds.length} students. Notified ${parentIds.length} families (${emailsSent} emails sent).`,
    families_notified: parentIds.length,
    students_placed: studentIds.length,
    emails_sent: emailsSent,
  });
}
