"use client";

import type { AssistantConfig } from "@/lib/assistant/config";

interface LevelUpCardProps {
  config: AssistantConfig;
  studentName: string;
  currentLevel: string;
  nextLevel: string;
  className: string;
  onRequest: () => void;
}

export function LevelUpCard({
  config,
  studentName,
  currentLevel,
  nextLevel,
  className,
  onRequest,
}: LevelUpCardProps) {
  const wrapperStyle = {
    "--assistant-color": config.primaryColor,
  } as React.CSSProperties;

  return (
    <div
      style={wrapperStyle}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <h3 className="mb-3 text-sm font-bold text-charcoal">
        Is {studentName} ready for the next level?
      </h3>

      {/* Level progression */}
      <div className="mb-3 flex items-center justify-center gap-3">
        {/* Current level badge */}
        <div
          style={{
            backgroundColor: `${config.primaryColor}1A`,
            color: config.primaryColor,
          }}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          {currentLevel}
        </div>

        {/* Arrow */}
        <svg
          className="h-5 w-5 text-mist"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>

        {/* Next level badge */}
        <div
          style={{
            backgroundColor: config.primaryColor,
            color: "#fff",
          }}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          {nextLevel}
        </div>
      </div>

      {/* Class name */}
      <p className="mb-2 text-center text-xs font-medium text-charcoal">
        {className}
      </p>

      {/* Teacher approval note */}
      <div className="mb-4 flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-xs text-amber-700">
          This requires teacher approval
        </span>
      </div>

      {/* Request button */}
      <button
        type="button"
        onClick={onRequest}
        style={{ backgroundColor: config.primaryColor }}
        className="h-10 w-full rounded-lg text-sm font-medium text-white transition hover:opacity-90"
      >
        Request Level Up
      </button>
    </div>
  );
}
