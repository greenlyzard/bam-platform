import { requireParent } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getStudentDetail,
  getStudentAttendanceSummary,
  getStudentContacts,
} from "@/lib/queries/portal";
import { calculateAge } from "@/lib/utils";
import Link from "next/link";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlist: "bg-gold/10 text-gold-dark",
  pending_payment: "bg-gold/10 text-gold-dark",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-[#CD7F32]/10 text-[#CD7F32]",
  silver: "bg-silver/30 text-slate",
  gold: "bg-gold/10 text-gold-dark",
  platinum: "bg-lavender/10 text-lavender-dark",
};

const CATEGORY_ICONS: Record<string, string> = {
  attendance: "📅",
  performance: "🎭",
  competition: "🏆",
  skill: "⭐",
  milestone: "🎯",
  leadership: "👑",
  special: "✨",
};

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireParent();
  const { studentId } = await params;
  const supabase = await createClient();

  // Parallel fetch all data
  const [student, attendance, contacts] = await Promise.all([
    getStudentDetail(studentId),
    getStudentAttendanceSummary(studentId),
    getStudentContacts(studentId),
  ]);

  if (!student) notFound();

  // Fetch badges, evaluations, photo albums
  const [badgesResult, evalsResult, albumsResult] = await Promise.all([
    supabase
      .from("student_badges")
      .select("id, awarded_at, notes, badge_id, badges(name, description, category, tier, icon_url)")
      .eq("student_id", studentId)
      .order("awarded_at", { ascending: false }),
    supabase
      .from("student_evaluations")
      .select("id, evaluation_type, title, body, attributed_to_name, is_private, created_at, template_id, class_id, status")
      .eq("student_id", studentId)
      .eq("is_private", false)
      .or("status.eq.published,status.is.null")
      .order("created_at", { ascending: false }),
    supabase
      .from("student_google_photo_albums")
      .select("id, label, album_url, is_active")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const badges = badgesResult.data ?? [];
  const evaluations = evalsResult.data ?? [];
  const albums = albumsResult.data ?? [];

  // Fetch template-based evaluation responses + question labels
  const templateEvalIds = evaluations.filter((e) => e.template_id).map((e) => e.id);
  let responsesMap: Record<string, Array<{ slug: string; label: string; question_type: string; response_value: string; section_name: string; section_order: number; question_order: number }>> = {};

  if (templateEvalIds.length > 0) {
    const { data: responseRows } = await supabase
      .from("student_evaluation_responses")
      .select("evaluation_id, question_slug, response_value, evaluation_question_bank(slug, label, question_type)")
      .in("evaluation_id", templateEvalIds);

    // Fetch template sections for grouping
    const templateIds = [...new Set(evaluations.filter((e) => e.template_id).map((e) => e.template_id as string))];
    const { data: sectionRows } = await supabase
      .from("evaluation_template_sections")
      .select("template_id, name, slug, sort_order, question_slugs")
      .in("template_id", templateIds)
      .order("sort_order");

    // Build a map: template_id -> sections with question slugs
    const sectionsMap: Record<string, Array<{ name: string; slug: string; sort_order: number; question_slugs: string[] }>> = {};
    for (const sec of sectionRows ?? []) {
      if (!sectionsMap[sec.template_id]) sectionsMap[sec.template_id] = [];
      sectionsMap[sec.template_id].push({
        name: sec.name,
        slug: sec.slug,
        sort_order: sec.sort_order,
        question_slugs: sec.question_slugs ?? [],
      });
    }

    // Build responsesMap grouped by section for each evaluation
    for (const ev of evaluations.filter((e) => e.template_id)) {
      const evResponses = (responseRows ?? []).filter((r) => r.evaluation_id === ev.id);
      const sections = sectionsMap[ev.template_id as string] ?? [];
      const grouped: typeof responsesMap[string] = [];

      for (const sec of sections) {
        for (let qi = 0; qi < sec.question_slugs.length; qi++) {
          const slug = sec.question_slugs[qi];
          const resp = evResponses.find((r) => r.question_slug === slug);
          if (!resp || !resp.response_value) continue;
          const qb = resp.evaluation_question_bank as unknown as { slug: string; label: string; question_type: string } | null;
          grouped.push({
            slug,
            label: qb?.label ?? slug,
            question_type: qb?.question_type ?? "free_text",
            response_value: resp.response_value,
            section_name: sec.name,
            section_order: sec.sort_order,
            question_order: qi,
          });
        }
      }

      responsesMap[ev.id] = grouped;
    }
  }

  // Fetch class names for evaluations with class_id
  const evalClassIds = [...new Set(evaluations.map((e) => e.class_id).filter(Boolean) as string[])];
  const evalClassMap: Record<string, string> = {};
  if (evalClassIds.length > 0) {
    const { data: classRows } = await supabase
      .from("classes")
      .select("id, name, simple_name")
      .in("id", evalClassIds);
    for (const c of classRows ?? []) {
      evalClassMap[c.id] = c.simple_name || c.name;
    }
  }

  const age = calculateAge(student.date_of_birth);
  const initials = `${student.first_name[0]}${student.last_name[0]}`;
  const displayName = student.preferred_name || student.first_name;
  const yearsAtStudio = student.created_at
    ? Math.floor((Date.now() - new Date(student.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/dashboard"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* ── Hero / Profile Header ──────────────────────────── */}
      <div className="rounded-xl border border-silver bg-white overflow-hidden">
        {/* Gradient banner */}
        <div className="h-24 bg-gradient-to-r from-lavender via-lavender-light to-gold-light" />
        <div className="px-5 pb-5 -mt-10">
          <div className="flex items-end gap-4">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md"
              />
            ) : (
              <div className="h-20 w-20 rounded-full border-4 border-white bg-lavender-light flex items-center justify-center text-xl font-bold text-lavender-dark shadow-md">
                {initials}
              </div>
            )}
            <div className="pb-1">
              <h1 className="text-2xl font-heading font-semibold text-charcoal">
                {displayName} {student.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-slate">Age {age}</span>
                {student.current_level && (
                  <span className="inline-block rounded-full bg-lavender/10 text-lavender-dark px-2.5 py-0.5 text-xs font-medium">
                    {student.current_level}
                  </span>
                )}
                {yearsAtStudio !== null && yearsAtStudio >= 1 && (
                  <span className="text-xs text-mist">
                    · Dancer since {new Date(student.created_at).getFullYear()}
                  </span>
                )}
              </div>
              {badges.length > 0 && (
                <p className="text-xs text-mist mt-1">{badges.length} badge{badges.length !== 1 ? "s" : ""} earned</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Badges & Achievements ──────────────────────────── */}
      {badges.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Badges & Achievements
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {badges.map((sb) => {
              const badge = sb.badges as unknown as {
                name: string;
                description: string | null;
                category: string;
                tier: string;
                icon_url: string | null;
              } | null;
              if (!badge) return null;
              const tierClass = TIER_COLORS[badge.tier] ?? TIER_COLORS.bronze;
              const icon = CATEGORY_ICONS[badge.category] ?? "🏅";
              return (
                <div
                  key={sb.id}
                  className="rounded-xl border border-silver/50 p-3 text-center hover:shadow-sm transition-shadow"
                >
                  <div className="text-2xl mb-1.5">{icon}</div>
                  <p className="text-sm font-medium text-charcoal leading-tight">{badge.name}</p>
                  <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${tierClass}`}>
                    {badge.tier}
                  </span>
                  {badge.description && (
                    <p className="text-[10px] text-mist mt-1 leading-tight">{badge.description}</p>
                  )}
                  <p className="text-[10px] text-mist mt-1">
                    {formatDate(sb.awarded_at)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Attendance Summary ─────────────────────────────── */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          This Month&apos;s Attendance
        </h2>
        {attendance.total === 0 ? (
          <p className="text-sm text-mist">No attendance records this month.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AttendanceStat label="Present" count={attendance.present} color="text-success" />
            <AttendanceStat label="Absent" count={attendance.absent} color="text-error" />
            <AttendanceStat label="Late" count={attendance.late} color="text-gold-dark" />
            <AttendanceStat label="Excused" count={attendance.excused} color="text-slate" />
          </div>
        )}
      </div>

      {/* ── Enrolled Classes ──────────────────────────────── */}
      <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
        <h2 className="text-lg font-heading font-semibold text-charcoal">
          Enrolled Classes
        </h2>
        {student.enrollments.length === 0 ? (
          <p className="text-sm text-mist">Not currently enrolled in any classes.</p>
        ) : (
          <div className="divide-y divide-silver/50">
            {student.enrollments.map((e: {
              id: string;
              status: string;
              enrollment_type: string;
              classes: {
                name: string;
                simple_name: string | null;
                day_of_week: number | null;
                start_time: string | null;
                end_time: string | null;
                room: string | null;
              } | null;
            }) => {
              const cls = (
                Array.isArray(e.classes) ? e.classes[0] : e.classes
              ) as {
                name: string;
                simple_name: string | null;
                day_of_week: number | null;
                start_time: string | null;
                end_time: string | null;
                room: string | null;
              } | null;
              if (!cls) return null;
              return (
                <div key={e.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-charcoal text-sm">
                      {cls.simple_name || cls.name}
                    </p>
                    <p className="text-xs text-mist">
                      {cls.day_of_week != null
                        ? `${DAY_NAMES[cls.day_of_week]} ${formatTime(cls.start_time)} - ${formatTime(cls.end_time)}`
                        : "Schedule TBD"}
                      {cls.room ? ` · ${cls.room}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[e.status] ?? "bg-cloud text-slate"
                    }`}
                  >
                    {e.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Evaluations ───────────────────────────────────── */}
      {evaluations.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Evaluations
          </h2>
          <div className="space-y-4">
            {evaluations.map((ev) => {
              const responses = responsesMap[ev.id];
              const className = ev.class_id ? evalClassMap[ev.class_id] : null;

              // Template-based evaluation
              if (ev.template_id && responses && responses.length > 0) {
                // Group responses by section
                const sections: Record<string, typeof responses> = {};
                const sectionOrder: Record<string, number> = {};
                for (const r of responses) {
                  if (!sections[r.section_name]) {
                    sections[r.section_name] = [];
                    sectionOrder[r.section_name] = r.section_order;
                  }
                  sections[r.section_name].push(r);
                }
                const sortedSections = Object.keys(sections).sort(
                  (a, b) => sectionOrder[a] - sectionOrder[b]
                );

                return (
                  <div key={ev.id} className="border-l-2 border-lavender pl-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-charcoal">{ev.title ?? "Evaluation"}</p>
                        {className && (
                          <span className="rounded-full bg-lavender/10 px-2 py-0.5 text-[10px] font-medium text-lavender-dark">
                            {className}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-mist mt-1">
                        {formatDate(ev.created_at)}
                        {ev.attributed_to_name ? ` · Instructor: ${ev.attributed_to_name}` : ""}
                      </p>
                    </div>

                    {sortedSections.map((sectionName) => (
                      <div key={sectionName} className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate uppercase tracking-wide">
                          {sectionName}
                        </p>
                        {sections[sectionName]
                          .sort((a, b) => a.question_order - b.question_order)
                          .map((r) => (
                            <div key={r.slug} className="flex items-start gap-2 text-sm">
                              <span className="text-slate min-w-0 shrink-0">{r.label}:</span>
                              {r.question_type === "nse_rating" && (
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                    r.response_value === "N"
                                      ? "bg-gold/10 text-gold-dark"
                                      : r.response_value === "S"
                                        ? "bg-info/10 text-info"
                                        : r.response_value === "E"
                                          ? "bg-success/10 text-success"
                                          : "bg-cloud text-slate"
                                  }`}
                                >
                                  {r.response_value}
                                </span>
                              )}
                              {r.question_type === "free_text" && (
                                <span className="border-l-2 border-lavender pl-3 text-sm text-slate italic">
                                  {r.response_value}
                                </span>
                              )}
                              {r.question_type === "level_placement" && (
                                <span className="inline-block rounded-full bg-lavender/10 px-2.5 py-0.5 text-xs font-medium text-lavender-dark">
                                  Recommended: {r.response_value}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                );
              }

              // Old-style evaluation (no template_id)
              return (
                <div key={ev.id} className="border-l-2 border-lavender pl-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-charcoal">{ev.title ?? "Note"}</p>
                    <span className="rounded-full bg-cloud px-2 py-0.5 text-[10px] font-medium text-slate capitalize">
                      {ev.evaluation_type?.replace("_", " ") ?? "evaluation"}
                    </span>
                    {className && (
                      <span className="rounded-full bg-lavender/10 px-2 py-0.5 text-[10px] font-medium text-lavender-dark">
                        {className}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate mt-1 leading-relaxed">{ev.body}</p>
                  <p className="text-xs text-mist mt-1.5">
                    {formatDate(ev.created_at)}
                    {ev.attributed_to_name ? ` · Instructor: ${ev.attributed_to_name}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Photo Gallery ─────────────────────────────────── */}
      {albums.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Photo Gallery
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {albums.map((album) => (
              <a
                key={album.id}
                href={album.album_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-silver/50 p-3 hover:bg-cloud/30 transition-colors"
              >
                <span className="text-2xl">📸</span>
                <div>
                  <p className="text-sm font-medium text-charcoal">{album.label}</p>
                  <p className="text-xs text-lavender">View album →</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Family Contacts ───────────────────────────────── */}
      {contacts.length > 0 && (
        <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
          <h2 className="text-lg font-heading font-semibold text-charcoal">
            Family Contacts
          </h2>
          <div className="divide-y divide-silver/50">
            {contacts.map((c: {
              id: string;
              first_name: string;
              last_name: string;
              relationship: string | null;
              phone: string | null;
              email: string | null;
              contact_type: string;
              is_primary: boolean;
            }) => (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-charcoal text-sm">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.is_primary && (
                    <span className="text-xs text-lavender">Primary</span>
                  )}
                  <span className="text-xs text-mist capitalize">
                    {c.contact_type}
                  </span>
                </div>
                <p className="text-xs text-mist">
                  {c.relationship ?? ""}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="text-center rounded-lg border border-silver/50 p-3">
      <p className={`text-2xl font-semibold ${color}`}>{count}</p>
      <p className="text-xs text-mist mt-1">{label}</p>
    </div>
  );
}
