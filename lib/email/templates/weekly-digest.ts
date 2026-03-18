import { renderEmailHtml, DEFAULT_LOGO_URL } from "../layout";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(d: Date): string {
  return `${DAYS[d.getDay()]}, ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

/** Build a Google Calendar link for a class on a specific date */
function googleCalendarLink(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location?: string;
}): string {
  const start = opts.date.replace(/-/g, "") + "T" + opts.startTime.replace(/:/g, "") + "00";
  const end = opts.date.replace(/-/g, "") + "T" + opts.endTime.replace(/:/g, "") + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${start}/${end}`,
    ctz: "America/Los_Angeles",
  });
  if (opts.location) params.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface ChildScheduleRow {
  className: string;
  day: string;
  time: string;
  teacher: string | null;
  room: string | null;
  changed: boolean;
  changeNote: string | null;
  calendarLink: string;
}

interface ChildDigest {
  childName: string;
  rows: ChildScheduleRow[];
}

interface DigestData {
  parentName: string;
  weekLabel: string;
  children: ChildDigest[];
  studioAnnouncements: string[];
}

function renderDigestBodyHtml(data: DigestData): string {
  const greeting = data.parentName ? data.parentName.split(" ")[0] : "there";

  let html = `
    <p style="margin: 0 0 8px 0; font-size: 15px; color: #2C2C2C;">
      Hi ${escapeHtml(greeting)},
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #6B6B7B;">
      Here&rsquo;s your family&rsquo;s schedule for the week of <strong>${escapeHtml(data.weekLabel)}</strong>.
    </p>
  `;

  for (const child of data.children) {
    html += `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 16px; background-color: #F5F0E8; border-radius: 8px 8px 0 0;">
            <p style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; font-weight: 600; color: #2C2C2C;">
              ${escapeHtml(child.childName)}
            </p>
          </td>
        </tr>
    `;

    if (child.rows.length === 0) {
      html += `
        <tr>
          <td style="padding: 16px; border: 1px solid #F0EDF3; border-top: 0; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 14px; color: #6B6B7B; font-style: italic;">No classes scheduled this week.</p>
          </td>
        </tr>
      `;
    } else {
      for (let i = 0; i < child.rows.length; i++) {
        const row = child.rows[i];
        const isLast = i === child.rows.length - 1;
        const bgColor = row.changed ? "#FFF8E1" : "#ffffff";
        const borderRadius = isLast ? "border-radius: 0 0 8px 8px;" : "";

        html += `
          <tr>
            <td style="padding: 12px 16px; background-color: ${bgColor}; border-left: 1px solid #F0EDF3; border-right: 1px solid #F0EDF3; ${isLast ? "border-bottom: 1px solid #F0EDF3;" : ""} ${borderRadius}">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: top;">
                    <p style="margin: 0; font-weight: 600; font-size: 14px; color: #2C2C2C;">
                      ${escapeHtml(row.className)}
                    </p>
                    <p style="margin: 2px 0 0 0; font-size: 13px; color: #6B6B7B;">
                      ${escapeHtml(row.day)} &middot; ${escapeHtml(row.time)}${row.teacher ? ` &middot; ${escapeHtml(row.teacher)}` : ""}${row.room ? ` &middot; ${escapeHtml(row.room)}` : ""}
                    </p>
                    ${
                      row.changed && row.changeNote
                        ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #C9A84C; font-weight: 600;">⚠ ${escapeHtml(row.changeNote)}</p>`
                        : ""
                    }
                  </td>
                  <td style="vertical-align: top; text-align: right; width: 30px;">
                    <a href="${escapeHtml(row.calendarLink)}" target="_blank" style="color: #9C8BBF; text-decoration: none; font-size: 18px;" title="Add to calendar">📅</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      }
    }

    html += `</table>`;
  }

  if (data.studioAnnouncements.length > 0) {
    html += `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 8px;">
        <tr>
          <td style="padding: 16px; background-color: #F5F0E8; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 16px; font-weight: 600; color: #2C2C2C;">Studio Updates</p>
            ${data.studioAnnouncements.map((a) => `<p style="margin: 0 0 4px 0; font-size: 13px; color: #6B6B7B;">&bull; ${escapeHtml(a)}</p>`).join("")}
          </td>
        </tr>
      </table>
    `;
  }

  return html;
}

/** Build digest data for a single parent */
export async function buildDigestForParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  weekStartDate: Date // Monday
): Promise<DigestData | null> {
  // Get parent profile
  const { data: parent } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("id", parentId)
    .single();

  if (!parent?.email) return null;

  const parentName = [parent.first_name, parent.last_name].filter(Boolean).join(" ");

  // Get children
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("parent_id", parentId)
    .eq("active", true);

  if (!students || students.length === 0) return null;

  // Week date range (Monday–Sunday)
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekLabel = `${formatDateShort(weekStartDate)}–${formatDateShort(weekEnd)}`;

  // Build date strings for the week (YYYY-MM-DD)
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    weekDates.push(d.toISOString().split("T")[0]);
  }

  // Get schedule changes for the week
  const { data: changes } = await supabase
    .from("schedule_instances")
    .select("id, class_id, teacher_id, room_id, event_date, start_time, end_time, status, cancellation_reason, substitute_teacher_id, notes")
    .in("event_date", weekDates)
    .in("status", ["cancelled", "modified", "published"]);

  // Build a map of class_id+date → change info
  const changeMap = new Map<string, typeof changes extends (infer T)[] | null ? T : never>();
  for (const ch of changes ?? []) {
    if (ch.status === "cancelled" || ch.substitute_teacher_id || ch.status === "modified") {
      changeMap.set(`${ch.class_id}:${ch.event_date}`, ch);
    }
  }

  // Get all teacher profiles we might need
  const subTeacherIds = new Set<string>();
  for (const ch of changes ?? []) {
    if (ch.substitute_teacher_id) subTeacherIds.add(ch.substitute_teacher_id);
  }

  // Build per-child schedules
  const children: ChildDigest[] = [];

  for (const student of students) {
    const childName = [student.first_name, student.last_name].filter(Boolean).join(" ");

    // Get enrollments
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id, classes(id, name, day_of_week, start_time, end_time, teacher_id, room)")
      .eq("student_id", student.id)
      .in("status", ["active", "trial"]);

    const rows: ChildScheduleRow[] = [];

    for (const enrollment of enrollments ?? []) {
      const cls = (enrollment as any).classes;
      if (!cls || cls.day_of_week == null) continue;

      // Check if this class falls in the week
      const classDate = weekDates.find((d) => {
        const dayOfWeek = new Date(d + "T12:00:00").getDay();
        return dayOfWeek === cls.day_of_week;
      });

      if (!classDate) continue;

      // Check for schedule change
      const change = changeMap.get(`${cls.id}:${classDate}`);
      let changed = false;
      let changeNote: string | null = null;
      let effectiveTeacherId = cls.teacher_id;

      if (change) {
        if (change.status === "cancelled") {
          changed = true;
          changeNote = `Class cancelled${change.cancellation_reason ? `: ${change.cancellation_reason}` : ""}`;
        } else if (change.substitute_teacher_id) {
          changed = true;
          effectiveTeacherId = change.substitute_teacher_id;
          changeNote = "Substitute teacher";
          subTeacherIds.add(change.substitute_teacher_id);
        }
      }

      // We'll resolve teacher names in a batch below
      rows.push({
        className: cls.name,
        day: formatDateFull(new Date(classDate + "T12:00:00")),
        time: `${formatTime(cls.start_time)}\u2013${formatTime(cls.end_time)}`,
        teacher: effectiveTeacherId, // temporarily store ID, resolve below
        room: cls.room ?? null,
        changed,
        changeNote,
        calendarLink: googleCalendarLink({
          title: cls.name,
          date: classDate,
          startTime: cls.start_time,
          endTime: cls.end_time,
          location: "Ballet Academy and Movement, 400-C Camino De Estrella, San Clemente, CA 92672",
        }),
      });
    }

    // Sort by day of week
    rows.sort((a, b) => {
      const dayA = weekDates.findIndex((d) => a.day.includes(DAYS[new Date(d + "T12:00:00").getDay()]));
      const dayB = weekDates.findIndex((d) => b.day.includes(DAYS[new Date(d + "T12:00:00").getDay()]));
      return dayA - dayB;
    });

    children.push({ childName, rows });
  }

  // Resolve all teacher IDs to names
  const allTeacherIds = new Set<string>();
  for (const child of children) {
    for (const row of child.rows) {
      if (row.teacher) allTeacherIds.add(row.teacher);
    }
  }

  let teacherNameMap: Record<string, string> = {};
  if (allTeacherIds.size > 0) {
    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...allTeacherIds]);

    for (const t of teachers ?? []) {
      teacherNameMap[t.id] = [t.first_name, t.last_name].filter(Boolean).join(" ");
    }
  }

  // Replace teacher IDs with names
  for (const child of children) {
    for (const row of child.rows) {
      if (row.teacher && teacherNameMap[row.teacher]) {
        row.teacher = teacherNameMap[row.teacher];
      } else {
        row.teacher = null;
      }
    }
  }

  // Get recent announcements (sent in the past week)
  const oneWeekAgo = new Date(weekStartDate);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const { data: announcements } = await supabase
    .from("announcements")
    .select("title")
    .eq("status", "sent")
    .gte("sent_at", oneWeekAgo.toISOString())
    .order("sent_at", { ascending: false })
    .limit(5);

  const studioAnnouncements = (announcements ?? []).map((a) => a.title);

  return {
    parentName,
    weekLabel,
    children,
    studioAnnouncements,
  };
}

/** Render the full digest email HTML for a parent */
export function renderDigestEmail(
  data: DigestData,
  logoUrl: string = DEFAULT_LOGO_URL
): string {
  const bodyHtml = renderDigestBodyHtml(data);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.balletacademyandmovement.com";

  return renderEmailHtml({
    headerText: `Week of ${data.weekLabel}`,
    bodyHtml,
    buttonText: "View Full Schedule",
    buttonUrl: `${appUrl}/portal/dashboard`,
    logoUrl,
  });
}

/** Get the Monday of the given week */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get next Monday from the given date */
export function getNextMonday(date: Date): Date {
  const monday = getMonday(date);
  monday.setDate(monday.getDate() + 7);
  return monday;
}
