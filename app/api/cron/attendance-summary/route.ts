import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/emails";
import { renderEmailHtml, DEFAULT_LOGO_URL } from "@/lib/email/layout";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

/**
 * Daily attendance summary email — Vercel Cron Job.
 * Runs at 9:00 AM Pacific (17:00 UTC) every day.
 * Sends a summary to admins of yesterday's sessions:
 *   - Which classes had attendance taken
 *   - Which classes had no attendance
 *   - Which classes have no timesheet hours logged
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get yesterday's date in Pacific time
  const now = new Date();
  const pacificOffset = -8; // PST; adjust for PDT if needed
  const pacificNow = new Date(now.getTime() + pacificOffset * 60 * 60 * 1000);
  const yesterday = new Date(pacificNow);
  yesterday.setDate(pacificNow.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const yesterdayDow = yesterday.getDay();

  // Get all active classes that run on yesterday's day of week
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, teacher_id")
    .eq("is_active", true)
    .eq("day_of_week", yesterdayDow);

  if (!classes?.length) {
    return NextResponse.json({ message: "No classes yesterday, no email sent." });
  }

  // Get teacher names
  const teacherIds = [...new Set(classes.map((c) => c.teacher_id).filter(Boolean))];
  const { data: profiles } = teacherIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", teacherIds)
    : { data: [] };

  const teacherMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    teacherMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
  }

  // Get attendance records for yesterday
  const classIds = classes.map((c) => c.id);
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("class_id, student_id, status")
    .in("class_id", classIds)
    .eq("class_date", yesterdayStr);

  // Build attendance map: classId → { present, total }
  const attendanceMap: Record<string, { present: number; total: number }> = {};
  for (const r of attendanceRecords ?? []) {
    if (!attendanceMap[r.class_id]) attendanceMap[r.class_id] = { present: 0, total: 0 };
    attendanceMap[r.class_id].total++;
    if (r.status === "present" || r.status === "late") {
      attendanceMap[r.class_id].present++;
    }
  }

  // Get timesheet entries for yesterday
  const { data: timesheetEntries } = await supabase
    .from("timesheet_entries")
    .select("class_id")
    .in("class_id", classIds)
    .eq("date", yesterdayStr);

  const hoursLoggedSet = new Set<string>();
  for (const e of timesheetEntries ?? []) {
    if (e.class_id) hoursLoggedSet.add(e.class_id);
  }

  // Build session summaries
  interface SessionSummary {
    className: string;
    teacherName: string;
    time: string;
    attendanceTaken: boolean;
    presentCount: number;
    enrolledCount: number;
    hoursLogged: boolean;
  }

  const sessions: SessionSummary[] = classes.map((c) => {
    const att = attendanceMap[c.id];
    return {
      className: c.name,
      teacherName: c.teacher_id ? (teacherMap[c.teacher_id] ?? "Unknown") : "Unassigned",
      time:
        c.start_time && c.end_time
          ? `${formatTime12h(c.start_time)} – ${formatTime12h(c.end_time)}`
          : "",
      attendanceTaken: !!att && att.total > 0,
      presentCount: att?.present ?? 0,
      enrolledCount: att?.total ?? 0,
      hoursLogged: hoursLoggedSet.has(c.id),
    };
  });

  // Count flags
  const noAttendance = sessions.filter((s) => !s.attendanceTaken);
  const noHours = sessions.filter((s) => !s.hoursLogged);

  // Build email HTML
  const dateLabel = new Date(yesterdayStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let tableRows = "";
  for (const s of sessions) {
    const attCell = s.attendanceTaken
      ? `<span style="color: #5A9E6F; font-weight: 600;">${s.presentCount}/${s.enrolledCount}</span>`
      : `<span style="color: #C45B5B; font-weight: 600;">Not taken</span>`;
    const hoursCell = s.hoursLogged
      ? `<span style="color: #5A9E6F;">&#10003;</span>`
      : `<span style="color: #C45B5B; font-weight: 600;">&#9888; Missing</span>`;

    tableRows += `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E8E8E8; font-size: 14px;">${s.className}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E8E8E8; font-size: 14px; color: #6B6B7B;">${s.teacherName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E8E8E8; font-size: 14px; color: #6B6B7B;">${s.time}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E8E8E8; font-size: 14px; text-align: center;">${attCell}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E8E8E8; font-size: 14px; text-align: center;">${hoursCell}</td>
      </tr>`;
  }

  const flagSection =
    noAttendance.length > 0 || noHours.length > 0
      ? `
    <div style="background-color: #FFF8F0; border: 1px solid #E8C87B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #8B6914; font-size: 14px;">Needs Attention</p>
      ${
        noAttendance.length > 0
          ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #2C2C2C;">&#9888; <strong>${noAttendance.length}</strong> session${noAttendance.length === 1 ? "" : "s"} with no attendance taken: ${noAttendance.map((s) => s.className).join(", ")}</p>`
          : ""
      }
      ${
        noHours.length > 0
          ? `<p style="margin: 0; font-size: 13px; color: #2C2C2C;">&#9888; <strong>${noHours.length}</strong> session${noHours.length === 1 ? "" : "s"} with no hours logged: ${noHours.map((s) => s.className).join(", ")}</p>`
          : ""
      }
    </div>`
      : "";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Here's yesterday's attendance summary for <strong>${dateLabel}</strong>.</p>

    ${flagSection}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #E8E8E8; border-radius: 8px; border-collapse: collapse; overflow: hidden;">
      <thead>
        <tr style="background-color: #F5F5F5;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B6B7B; text-transform: uppercase; letter-spacing: 0.5px;">Class</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B6B7B; text-transform: uppercase; letter-spacing: 0.5px;">Teacher</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B6B7B; text-transform: uppercase; letter-spacing: 0.5px;">Time</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6B6B7B; text-transform: uppercase; letter-spacing: 0.5px;">Attendance</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6B6B7B; text-transform: uppercase; letter-spacing: 0.5px;">Hours</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #6B6B7B;">
      ${sessions.length} total session${sessions.length === 1 ? "" : "s"} · ${sessions.filter((s) => s.attendanceTaken).length} with attendance · ${sessions.filter((s) => s.hoursLogged).length} with hours logged
    </p>
  `;

  const html = renderEmailHtml({
    headerText: "Daily Attendance Summary",
    bodyHtml,
    buttonText: "View Attendance",
    buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com"}/admin/attendance`,
    logoUrl: DEFAULT_LOGO_URL,
  });

  // Get admin email addresses
  const { data: adminRoles } = await supabase
    .from("profile_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"])
    .eq("is_active", true);

  const adminUserIds = [...new Set((adminRoles ?? []).map((r) => r.user_id))];
  if (adminUserIds.length === 0) {
    return NextResponse.json({ message: "No admins found, no email sent." });
  }

  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("email")
    .in("id", adminUserIds);

  const adminEmails = (adminProfiles ?? [])
    .map((p) => p.email)
    .filter((e): e is string => !!e);

  if (adminEmails.length === 0) {
    return NextResponse.json({ message: "No admin emails found." });
  }

  // Send the email
  await sendEmail({
    to: adminEmails,
    subject: `Attendance Summary — ${DAYS[yesterdayDow]}, ${new Date(yesterdayStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    html,
    replyTo: "dance@bamsocal.com",
  });

  return NextResponse.json({
    message: `Sent attendance summary to ${adminEmails.length} admin(s).`,
    sessions: sessions.length,
    noAttendance: noAttendance.length,
    noHours: noHours.length,
  });
}
