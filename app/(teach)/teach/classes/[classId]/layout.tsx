import { requireTeacher } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

const TABS = [
  { label: "Roster", href: "roster" },
  { label: "Attendance", href: "attendance" },
  { label: "Notes", href: "notes" },
  { label: "Curriculum", href: "curriculum" },
  { label: "Files", href: "files" },
  { label: "Metrics", href: "metrics" },
];

export default async function ClassDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ classId: string }>;
}) {
  const user = await requireTeacher();
  const { classId } = await params;
  const supabase = createAdminClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, discipline, day_of_week, start_time, end_time, room_id, levels, max_enrollment, color_hex, season_id")
    .eq("id", classId)
    .single();

  if (!cls) redirect("/teach/classes");

  // Verify teacher is assigned
  const { data: assignment } = await supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!assignment) redirect("/teach/classes");

  // Resolve room name
  let roomName: string | null = null;
  if (cls.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", cls.room_id)
      .single();
    roomName = room?.name ?? null;
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate">
        <Link href="/teach/classes" className="hover:text-charcoal transition-colors">
          My Classes
        </Link>
        <span>/</span>
        <span className="text-charcoal">{cls.name}</span>
      </div>

      {/* Class Header */}
      <div className="rounded-xl border border-silver bg-white p-5">
        <div className="flex items-start gap-3">
          {cls.color_hex && (
            <span
              className="mt-1.5 w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: cls.color_hex }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-heading font-semibold text-charcoal">{cls.name}</h1>
            <p className="text-sm text-slate mt-0.5">
              {cls.discipline && <span>{cls.discipline}</span>}
              {cls.day_of_week != null && <span> · {DAY_NAMES[cls.day_of_week]}</span>}
              {cls.start_time && <span> · {formatTime(cls.start_time)}</span>}
              {cls.end_time && <span> – {formatTime(cls.end_time)}</span>}
              {roomName && <span className="text-mist"> · {roomName}</span>}
            </p>
            {cls.levels && cls.levels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cls.levels.map((level: string) => (
                  <span
                    key={level}
                    className="inline-flex items-center rounded-full bg-lavender/10 px-2 py-0.5 text-[10px] font-medium text-lavender-dark"
                  >
                    {level}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 border-b border-silver">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={`/teach/classes/${classId}/${tab.href}`}
            className="px-4 py-2.5 text-sm font-medium text-slate hover:text-charcoal border-b-2 border-transparent hover:border-lavender/50 transition-colors -mb-px"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Tab Content */}
      {children}
    </div>
  );
}
