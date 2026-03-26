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

  // Fetch profiles with an active teacher role
  const { data: roleRows } = await supabase
    .from("profile_roles")
    .select("user_id")
    .eq("role", "teacher")
    .eq("is_active", true);

  if (!roleRows || roleRows.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-mist text-lg">No teachers found.</p>
      </div>
    );
  }

  const teacherIds = roleRows.map((r) => r.user_id);

  const [profilesResult, disciplinesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, title, bio_short")
      .in("id", teacherIds)
      .order("first_name"),
    supabase
      .from("teacher_disciplines")
      .select("teacher_id, name, icon_library(icon_url)")
      .in("teacher_id", teacherIds)
      .order("sort_order"),
  ]);

  const disciplineMap = new Map<string, { name: string; icon_url: string | null }[]>();
  for (const d of disciplinesResult.data ?? []) {
    const iconLib = d.icon_library as any;
    const entry = { name: d.name, icon_url: iconLib?.icon_url ?? null };
    const existing = disciplineMap.get(d.teacher_id) ?? [];
    existing.push(entry);
    disciplineMap.set(d.teacher_id, existing);
  }

  const teachers: TeacherCard[] = (profilesResult.data ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    avatar_url: p.avatar_url,
    title: p.title ?? null,
    bio_short: p.bio_short ?? null,
    disciplines: disciplineMap.get(p.id) ?? [],
  }));

  return (
    <div className="min-h-screen bg-cream">
      <header className="pt-16 pb-10 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-light text-charcoal font-heading">
          Meet Our Teachers
        </h1>
        <p className="mt-3 text-mist text-base">Ballet Academy and Movement</p>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teachers.map((teacher) => {
            const slug = `${teacher.first_name}-${teacher.last_name}`
              .toLowerCase()
              .replace(/\s+/g, "-");
            const initials =
              (teacher.first_name?.[0] ?? "") + (teacher.last_name?.[0] ?? "");

            return (
              <Link
                key={teacher.id}
                href={`/teachers/${slug}`}
                className="group rounded-xl border border-silver bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
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
                    <span className="text-3xl font-light text-lavender font-heading">
                      {initials}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h2 className="font-semibold text-charcoal font-heading">
                    {teacher.first_name} {teacher.last_name}
                  </h2>
                  {teacher.title && (
                    <p className="text-sm text-slate mt-0.5">{teacher.title}</p>
                  )}
                  {teacher.bio_short && (
                    <p className="text-xs text-mist mt-2 leading-relaxed line-clamp-2">
                      {teacher.bio_short}
                    </p>
                  )}

                  {/* Discipline icons */}
                  {teacher.disciplines.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3">
                      {teacher.disciplines.slice(0, 4).map((d, i) => (
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

                  <p className="text-xs text-lavender mt-3 group-hover:underline">
                    View Profile &rarr;
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
