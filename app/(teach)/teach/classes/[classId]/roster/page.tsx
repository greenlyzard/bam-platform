import { requireTeacher } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  trial: "bg-lavender/10 text-lavender-dark",
  waitlisted: "bg-gold/10 text-gold-dark",
};

export default async function ClassRosterPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireTeacher();
  const supabase = await createClient();
  const { classId } = await params;

  // Fetch class details
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time, end_time, room")
    .eq("id", classId)
    .single();

  if (!cls) return notFound();

  // Verify teacher is assigned to this class
  const { data: assignment } = await supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .limit(1)
    .single();

  if (!assignment) return notFound();

  // Fetch enrolled students
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      status,
      enrolled_at,
      student:students (
        id, first_name, last_name, avatar_url, current_level, date_of_birth
      )
    `)
    .eq("class_id", classId)
    .in("status", ["active", "trial"]);

  const students = (enrollments ?? [])
    .filter((e) => e.student)
    .map((e) => {
      const s = e.student as any;
      return {
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        avatarUrl: s.avatar_url,
        level: s.current_level,
        dob: s.date_of_birth,
        enrolledAt: e.enrolled_at,
        status: e.status,
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate">
        <Link href="/teach/classes" className="hover:text-charcoal transition-colors">
          My Classes
        </Link>
        <span>/</span>
        <span className="text-charcoal">Roster</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">{cls.name}</h1>
          <p className="mt-1 text-sm text-slate">
            {cls.day_of_week != null && DAY_NAMES[cls.day_of_week]}
            {cls.start_time && ` · ${formatTime(cls.start_time)}`}
            {cls.end_time && ` – ${formatTime(cls.end_time)}`}
            {cls.room && <span className="text-mist"> · {cls.room}</span>}
          </p>
        </div>
        <Link
          href={`/teach/classes/${classId}/attendance`}
          className="shrink-0 inline-flex h-9 items-center rounded-lg bg-lavender px-4 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
        >
          Take Attendance
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No students enrolled in this class.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate">{students.length} student{students.length !== 1 ? "s" : ""}</p>
          {students.map((s) => {
            const initials = `${s.firstName[0]}${s.lastName[0]}`.toUpperCase();
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-silver bg-white p-3 hover:shadow-sm transition-shadow"
              >
                {s.avatarUrl ? (
                  <img src={s.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender/10 text-sm font-semibold text-lavender-dark">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal truncate">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-slate">
                    {s.level && <span>{s.level.replace(/_/g, " ")}</span>}
                    {s.dob && <span> · Age {calculateAge(s.dob)}</span>}
                    {s.enrolledAt && (
                      <span className="text-mist">
                        {" "}· Enrolled {new Date(s.enrolledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[s.status] ?? "bg-cloud text-slate"}`}>
                  {s.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
