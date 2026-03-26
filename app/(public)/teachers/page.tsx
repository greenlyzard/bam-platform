import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = {
  title: "Meet Our Teachers | Ballet Academy and Movement",
  description:
    "Meet the talented instructors at Ballet Academy and Movement in San Clemente, CA.",
};

interface TeacherCard {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  title: string | null;
  bio_short: string | null;
  disciplines: { name: string; icon_url: string | null }[];
}

export default async function PublicTeachersPage() {
  const supabase = await createClient();

  // Fetch active teachers via the teacher_profiles view
  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name, avatar_url, is_active")
    .eq("is_active", true)
    .order("first_name");

  if (!teacherProfiles || teacherProfiles.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-mist text-lg">No teachers found.</p>
      </div>
    );
  }

  // Fetch extended profile data + disciplines for each teacher
  const teacherIds = teacherProfiles.map((t) => t.id);

  const [profilesResult, disciplinesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, title, bio_short")
      .in("id", teacherIds),
    supabase
      .from("teacher_disciplines")
      .select("teacher_id, name, icon_library(icon_url)")
      .in("teacher_id", teacherIds)
      .order("sort_order"),
  ]);

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );
  const disciplineMap = new Map<string, { name: string; icon_url: string | null }[]>();
  for (const d of disciplinesResult.data ?? []) {
    const iconLib = d.icon_library as any;
    const entry = { name: d.name, icon_url: iconLib?.icon_url ?? null };
    const existing = disciplineMap.get(d.teacher_id) ?? [];
    existing.push(entry);
    disciplineMap.set(d.teacher_id, existing);
  }

  const teachers: TeacherCard[] = teacherProfiles.map((t) => {
    const profile = profileMap.get(t.id);
    return {
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      avatar_url: t.avatar_url,
      title: profile?.title ?? null,
      bio_short: profile?.bio_short ?? null,
      disciplines: disciplineMap.get(t.id) ?? [],
    };
  });

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="pt-16 pb-10 px-4 text-center">
        <h1
          className="text-4xl md:text-5xl font-light text-charcoal"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Meet Our Teachers
        </h1>
        <p className="mt-3 text-mist text-base">Ballet Academy and Movement</p>
      </header>

      {/* Teacher grid */}
      <main className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teachers.map((teacher) => {
            const slug = `${teacher.first_name}-${teacher.last_name}`
              .toLowerCase()
              .replace(/\s+/g, "-");
            const initials =
              (teacher.first_name?.[0] ?? "") + (teacher.last_name?.[0] ?? "");
            const shortBio = teacher.bio_short
              ? teacher.bio_short.length > 120
                ? teacher.bio_short.slice(0, 120) + "..."
                : teacher.bio_short
              : null;

            return (
              <Link
                key={teacher.id}
                href={`/teachers/${slug}`}
                className="group rounded-xl border border-silver bg-white overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Headshot */}
                <div className="aspect-square bg-lavender-light flex items-center justify-center overflow-hidden">
                  {teacher.avatar_url ? (
                    <img
                      src={teacher.avatar_url}
                      alt={`${teacher.first_name} ${teacher.last_name}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span
                      className="text-3xl font-light text-lavender"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {initials}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h2
                    className="text-lg font-medium text-charcoal"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {teacher.first_name} {teacher.last_name}
                  </h2>
                  {teacher.title && (
                    <p className="text-xs text-lavender mt-0.5">{teacher.title}</p>
                  )}
                  {shortBio && (
                    <p className="text-xs text-mist mt-2 leading-relaxed">
                      {shortBio}
                    </p>
                  )}

                  {/* Discipline icons */}
                  {teacher.disciplines.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3">
                      {teacher.disciplines.map((d, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full bg-lavender-light flex items-center justify-center overflow-hidden"
                          title={d.name}
                        >
                          {d.icon_url ? (
                            <img
                              src={d.icon_url}
                              alt={d.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-[8px] font-medium text-lavender">
                              {d.name.charAt(0)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
