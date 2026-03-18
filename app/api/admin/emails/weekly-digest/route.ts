import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import {
  buildDigestForParent,
  renderDigestEmail,
  getMonday,
} from "@/lib/email/templates/weekly-digest";
import { DEFAULT_LOGO_URL } from "@/lib/email/layout";

const DEFAULT_REPLY_TO = "dance@bamsocal.com";
const FROM = "Ballet Academy and Movement <hello@balletacademyandmovement.com>";

/**
 * POST /api/admin/emails/weekly-digest
 * Body: { week_start?: string (YYYY-MM-DD), profile_id?: string }
 *
 * If profile_id is provided, sends digest to that one parent (preview/test).
 * If no profile_id, sends to all parents with active enrollments.
 */
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const tenantId = user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }
  const body = await req.json();

  const weekStart = body.week_start
    ? getMonday(new Date(body.week_start + "T12:00:00"))
    : getMonday(new Date());

  // Fetch logo
  let logoUrl = DEFAULT_LOGO_URL;
  try {
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("logo_url")
      .limit(1)
      .single();
    if (settings?.logo_url) logoUrl = settings.logo_url;
  } catch { /* use default */ }

  // If a specific parent, just send to them
  if (body.profile_id) {
    const data = await buildDigestForParent(supabase, body.profile_id, weekStart);
    if (!data) {
      return NextResponse.json(
        { error: "No digest data for this parent (no active students or no email)" },
        { status: 404 }
      );
    }

    const html = renderDigestEmail(data, logoUrl);

    // Get parent email
    const { data: parent } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", body.profile_id)
      .single();

    if (!parent?.email || !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Cannot send email" }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendErr } = await resend.emails.send({
      from: FROM,
      to: parent.email,
      replyTo: DEFAULT_REPLY_TO,
      subject: `Your Weekly Schedule — ${data.weekLabel}`,
      html,
    });

    if (sendErr) {
      return NextResponse.json({ error: sendErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent: 1, weekLabel: data.weekLabel });
  }

  // Bulk send to all parents with active enrollments
  const parentIds = await getParentsWithActiveEnrollments(supabase, tenantId);

  if (parentIds.length === 0) {
    return NextResponse.json({ success: true, sent: 0, weekLabel: formatWeekLabel(weekStart) });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;

  // Process in batches of 10 parents
  for (let i = 0; i < parentIds.length; i += 10) {
    const batch = parentIds.slice(i, i + 10);

    const emailBatch: Array<{
      from: string;
      to: string;
      replyTo: string;
      subject: string;
      html: string;
    }> = [];

    for (const pid of batch) {
      const data = await buildDigestForParent(supabase, pid, weekStart);
      if (!data) continue;

      const { data: parent } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", pid)
        .single();

      if (!parent?.email) continue;

      emailBatch.push({
        from: FROM,
        to: parent.email,
        replyTo: DEFAULT_REPLY_TO,
        subject: `Your Weekly Schedule — ${data.weekLabel}`,
        html: renderDigestEmail(data, logoUrl),
      });
    }

    if (emailBatch.length > 0) {
      try {
        await resend.batch.send(emailBatch);
        sent += emailBatch.length;
      } catch (err) {
        console.error("[weekly-digest] Batch send error:", err);
        failed += emailBatch.length;
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: parentIds.length,
    weekLabel: formatWeekLabel(weekStart),
  });
}

/**
 * GET /api/admin/emails/weekly-digest?week_start=YYYY-MM-DD&profile_id=xxx
 * Preview digest data for a specific parent without sending.
 */
export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const tenantId = user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profile_id");
  const weekStartParam = searchParams.get("week_start");

  const weekStart = weekStartParam
    ? getMonday(new Date(weekStartParam + "T12:00:00"))
    : getMonday(new Date());

  // If no profile_id, return list of eligible parents
  if (!profileId) {
    const parentIds = await getParentsWithActiveEnrollments(supabase, tenantId);

    // Get parent details
    if (parentIds.length === 0) {
      return NextResponse.json({ parents: [], weekLabel: formatWeekLabel(weekStart) });
    }

    const { data: parents } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", parentIds)
      .order("last_name");

    const enriched = (parents ?? []).map((p) => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      email: p.email,
    }));

    return NextResponse.json({ parents: enriched, weekLabel: formatWeekLabel(weekStart) });
  }

  // Preview for a specific parent
  const data = await buildDigestForParent(supabase, profileId, weekStart);
  if (!data) {
    return NextResponse.json(
      { error: "No digest data for this parent" },
      { status: 404 }
    );
  }

  // Fetch logo for HTML preview
  let logoUrl = DEFAULT_LOGO_URL;
  try {
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("logo_url")
      .limit(1)
      .single();
    if (settings?.logo_url) logoUrl = settings.logo_url;
  } catch { /* use default */ }

  const html = renderDigestEmail(data, logoUrl);

  return NextResponse.json({ data, html, weekLabel: data.weekLabel });
}

/**
 * Get parent IDs scoped to tenant who have at least one child with an active enrollment.
 * Tenant scoping goes through profile_roles (profiles has no tenant_id).
 */
async function getParentsWithActiveEnrollments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<string[]> {
  // 1. Get all active parent user_ids in this tenant via profile_roles
  const { data: parentRoles } = await supabase
    .from("profile_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "parent")
    .eq("is_active", true);

  const tenantParentIds = (parentRoles ?? []).map((r) => r.user_id);
  if (tenantParentIds.length === 0) return [];

  // 2. Get students belonging to these parents
  const { data: students } = await supabase
    .from("students")
    .select("id, parent_id")
    .in("parent_id", tenantParentIds)
    .eq("active", true);

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return [];

  // Build student → parent map
  const studentParentMap = new Map<string, string>();
  for (const s of students ?? []) {
    studentParentMap.set(s.id, s.parent_id);
  }

  // 3. Get active enrollments for these students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .in("student_id", studentIds)
    .in("status", ["active", "trial"]);

  // 4. Map back to parent IDs
  const parentIds = [
    ...new Set(
      (enrollments ?? [])
        .map((e) => studentParentMap.get(e.student_id))
        .filter(Boolean) as string[]
    ),
  ];

  return parentIds;
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()}–${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
}
