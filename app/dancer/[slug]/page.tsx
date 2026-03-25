import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dancer Profile — Ballet Academy and Movement",
};

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

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob + "T12:00:00");
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

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

export default async function DancerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Look up relative by vanity_slug first, then share_token
  let relative: {
    id: string;
    student_id: string;
    name: string;
    relationship: string;
    is_active: boolean;
    tenant_id: string;
  } | null = null;

  const { data: bySlug } = await supabase
    .from("student_profile_relatives")
    .select("id, student_id, name, relationship, is_active, tenant_id")
    .eq("vanity_slug", slug)
    .eq("is_active", true)
    .single();

  if (bySlug) {
    relative = bySlug;
  } else {
    const { data: byToken } = await supabase
      .from("student_profile_relatives")
      .select("id, student_id, name, relationship, is_active, tenant_id")
      .eq("share_token", slug)
      .eq("is_active", true)
      .single();
    relative = byToken;
  }

  // Not found or inactive
  if (!relative) {
    return (
      <Shell>
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🩰</div>
          <h1 className="text-xl font-heading font-semibold text-charcoal">
            This link is no longer active
          </h1>
          <p className="text-sm text-slate mt-2 max-w-sm mx-auto">
            The profile link you followed has been deactivated or doesn&apos;t exist.
            Please contact the dancer&apos;s family for an updated link.
          </p>
        </div>
      </Shell>
    );
  }

  // Fetch permissions for this relative
  const { data: permsData } = await supabase
    .from("student_profile_share_permissions")
    .select("section_key, is_visible")
    .eq("relative_id", relative.id);

  const perms = new Set(
    (permsData ?? [])
      .filter((p) => p.is_visible)
      .map((p) => p.section_key)
  );

  // If no permissions exist at all, show nothing
  if (perms.size === 0) {
    return (
      <Shell>
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🩰</div>
          <h1 className="text-xl font-heading font-semibold text-charcoal">
            Profile not available
          </h1>
          <p className="text-sm text-slate mt-2 max-w-sm mx-auto">
            No sections have been shared for this profile yet.
            Please contact the dancer&apos;s family.
          </p>
        </div>
      </Shell>
    );
  }

  // Fetch student (first name only — never expose last name)
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, preferred_name, date_of_birth, current_level, avatar_url, created_at")
    .eq("id", relative.student_id)
    .single();

  if (!student) {
    return (
      <Shell>
        <div className="text-center py-20">
          <p className="text-sm text-slate">Profile not found.</p>
        </div>
      </Shell>
    );
  }

  const displayName = student.preferred_name || student.first_name;
  const age = calculateAge(student.date_of_birth);
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const enrolledYear = student.created_at
    ? new Date(student.created_at).getFullYear()
    : null;

  // Conditionally fetch data based on permissions
  const [badgesResult, albumsResult, enrollmentsResult] = await Promise.all([
    perms.has("badges")
      ? supabase
          .from("student_badges")
          .select("id, awarded_at, badge_id, badges(name, description, category, tier, icon_url)")
          .eq("student_id", student.id)
          .order("awarded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    perms.has("photos")
      ? supabase
          .from("student_google_photo_albums")
          .select("id, label, album_url")
          .eq("student_id", student.id)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    perms.has("schedule")
      ? supabase
          .from("enrollments")
          .select("id, status, classes(name, simple_name, day_of_week, start_time, end_time)")
          .eq("student_id", student.id)
          .in("status", ["active", "trial"])
      : Promise.resolve({ data: [] }),
  ]);

  const badges = badgesResult.data ?? [];
  const albums = albumsResult.data ?? [];
  const enrollments = enrollmentsResult.data ?? [];

  return (
    <Shell>
      <div className="space-y-6">
        {/* ── Hero ───────────────────────────────────────── */}
        {perms.has("bio") && (
          <div className="text-center">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={displayName}
                className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg mx-auto"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-lavender-light flex items-center justify-center text-2xl font-bold text-lavender-dark shadow-lg mx-auto">
                {initial}
              </div>
            )}
            <h1 className="text-3xl font-heading font-semibold text-charcoal mt-4">
              {displayName}
            </h1>
            {age !== null && (
              <p className="text-sm text-slate mt-1">Age {age}</p>
            )}
            {perms.has("level") && student.current_level && (
              <span className="inline-block mt-2 rounded-full bg-lavender/10 text-lavender-dark px-3 py-1 text-sm font-medium">
                {student.current_level}
              </span>
            )}
            {enrolledYear && (
              <p className="text-xs text-mist mt-2">
                Dancer since {enrolledYear}
              </p>
            )}
          </div>
        )}

        {/* ── Level (standalone if bio is hidden) ────────── */}
        {!perms.has("bio") && perms.has("level") && student.current_level && (
          <div className="text-center">
            <span className="inline-block rounded-full bg-lavender/10 text-lavender-dark px-3 py-1 text-sm font-medium">
              {student.current_level}
            </span>
          </div>
        )}

        {/* ── Badges ─────────────────────────────────────── */}
        {perms.has("badges") && badges.length > 0 && (
          <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
            <h2 className="text-base font-heading font-semibold text-charcoal text-center">
              Achievements
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    className="rounded-xl border border-silver/50 p-3 text-center"
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className="text-sm font-medium text-charcoal leading-tight">
                      {badge.name}
                    </p>
                    <span
                      className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${tierClass}`}
                    >
                      {badge.tier}
                    </span>
                    <p className="text-[10px] text-mist mt-1">
                      {formatDate(sb.awarded_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Schedule ───────────────────────────────────── */}
        {perms.has("schedule") && enrollments.length > 0 && (
          <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
            <h2 className="text-base font-heading font-semibold text-charcoal text-center">
              Current Classes
            </h2>
            <div className="divide-y divide-silver/50">
              {(enrollments as any[]).map((e) => {
                const cls = (
                  Array.isArray(e.classes) ? e.classes[0] : e.classes
                ) as {
                  name: string;
                  simple_name: string | null;
                  day_of_week: number | null;
                  start_time: string | null;
                  end_time: string | null;
                } | null;
                if (!cls) return null;
                return (
                  <div key={e.id} className="py-3 text-center">
                    <p className="font-medium text-charcoal text-sm">
                      {cls.simple_name || cls.name}
                    </p>
                    <p className="text-xs text-mist mt-0.5">
                      {cls.day_of_week != null
                        ? `${DAY_NAMES[cls.day_of_week]} ${formatTime(cls.start_time)} – ${formatTime(cls.end_time)}`
                        : "Schedule TBD"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Photos ─────────────────────────────────────── */}
        {perms.has("photos") && albums.length > 0 && (
          <div className="rounded-xl border border-silver bg-white p-5 space-y-3">
            <h2 className="text-base font-heading font-semibold text-charcoal text-center">
              Photos
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
                  <span className="text-xl">📸</span>
                  <div>
                    <p className="text-sm font-medium text-charcoal">{album.label}</p>
                    <p className="text-xs text-lavender">View album →</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── Minimal public shell — no nav, no login ─────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-silver bg-white">
        <div className="max-w-lg mx-auto px-4 py-4 text-center">
          <p className="text-sm font-heading font-semibold text-charcoal tracking-wide">
            Ballet Academy and Movement
          </p>
          <p className="text-[10px] text-mist mt-0.5">San Clemente, California</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-silver bg-white mt-12">
        <div className="max-w-lg mx-auto px-4 py-4 text-center">
          <p className="text-[10px] text-mist">
            Ballet Academy and Movement · San Clemente, CA
          </p>
        </div>
      </footer>
    </div>
  );
}
