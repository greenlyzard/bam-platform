import { calculateAge } from "@/lib/utils";

interface DancerCardProps {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    current_level: string | null;
    age_group: string | null;
  };
  enrollmentCount?: number;
  badgeCount?: number;
}

const levelLabels: Record<string, string> = {
  pre_ballet: "Pre-Ballet",
  level_1: "Level 1",
  level_2: "Level 2",
  level_3: "Level 3",
  level_4: "Level 4",
  level_5: "Level 5",
  level_6: "Level 6",
  pointe: "Pointe",
};

const levelColors: Record<string, string> = {
  pre_ballet: "bg-lavender-light text-lavender-dark",
  level_1: "bg-success/10 text-success",
  level_2: "bg-info/10 text-info",
  level_3: "bg-lavender/10 text-lavender-dark",
  level_4: "bg-lavender/20 text-lavender-dark",
  level_5: "bg-gold-light text-gold-dark",
  level_6: "bg-gold/20 text-gold-dark",
  pointe: "bg-gold text-white",
};

export function DancerCard({
  student,
  enrollmentCount = 0,
  badgeCount = 0,
}: DancerCardProps) {
  const age = calculateAge(student.date_of_birth);
  const level = student.current_level ?? "pre_ballet";
  const initials = `${student.first_name[0]}${student.last_name[0]}`;

  return (
    <a
      href={`/portal/students/${student.id}`}
      className="block rounded-xl border border-silver bg-white p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="h-12 w-12 rounded-full bg-lavender-light flex items-center justify-center text-sm font-bold text-lavender-dark shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name and age */}
          <h3 className="font-semibold text-charcoal truncate">
            {student.first_name} {student.last_name}
          </h3>
          <p className="text-sm text-slate">Age {age}</p>

          {/* Level badge */}
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                levelColors[level] ?? "bg-cloud text-slate"
              }`}
            >
              {levelLabels[level] ?? level}
            </span>
          </div>

          {/* Stats */}
          <div className="mt-3 flex gap-4 text-xs text-slate">
            <span>
              {enrollmentCount} {enrollmentCount === 1 ? "class" : "classes"}
            </span>
            <span>
              {badgeCount} {badgeCount === 1 ? "badge" : "badges"}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
