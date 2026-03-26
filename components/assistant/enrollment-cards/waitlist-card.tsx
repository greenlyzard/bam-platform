"use client";

import type { AssistantConfig } from "@/lib/assistant/config";

interface WaitlistCardProps {
  config: AssistantConfig;
  className: string;
  onJoin: () => void;
}

export function WaitlistCard({ config, className, onJoin }: WaitlistCardProps) {
  return (
    <div
      style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <div className="mb-3 text-center">
        <p className="text-sm text-charcoal">
          <span className="font-medium">{className}</span> is currently full,
          but we&apos;d love to save you a spot as soon as one opens up.
        </p>
      </div>

      <button
        type="button"
        onClick={onJoin}
        style={{ backgroundColor: config.primaryColor }}
        className="h-9 w-full rounded-lg text-sm font-medium text-white transition hover:opacity-90"
      >
        Join Waitlist for {className}
      </button>

      <p className="mt-2 text-center text-[10px] text-mist">
        We&apos;ll notify you by email as soon as a spot opens.
      </p>
    </div>
  );
}
