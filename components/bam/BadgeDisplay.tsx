const tierStyles: Record<string, string> = {
  bronze: "text-amber-700 bg-amber-50 border-amber-200",
  silver: "text-slate bg-slate/5 border-silver",
  gold: "text-gold-dark bg-gold-light/30 border-gold",
  platinum: "text-charcoal bg-cloud border-lavender-light",
};

const categoryIcons: Record<string, string> = {
  skill: "◆",
  performance: "★",
  attendance: "●",
  milestone: "▲",
  leadership: "♛",
  competition: "◈",
  special: "✦",
};

interface BadgeDisplayProps {
  badge: {
    name: string;
    description: string | null;
    category: string;
    tier: string;
  };
  studentName?: string;
  awardedAt?: string;
  compact?: boolean;
}

export function BadgeDisplay({
  badge,
  studentName,
  awardedAt,
  compact = false,
}: BadgeDisplayProps) {
  const tier = badge.tier ?? "bronze";
  const icon = categoryIcons[badge.category] ?? "✦";

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          tierStyles[tier] ?? tierStyles.bronze
        }`}
      >
        <span>{icon}</span>
        {badge.name}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        tierStyles[tier] ?? tierStyles.bronze
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{icon}</span>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm">{badge.name}</h4>
          {badge.description && (
            <p className="text-xs mt-0.5 opacity-70">{badge.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-60">
            {studentName && <span>{studentName}</span>}
            {awardedAt && (
              <span>
                {new Date(awardedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <span className="capitalize">{tier}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
