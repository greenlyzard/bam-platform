"use client";

import type { AssistantConfig } from "@/lib/assistant/config";

interface EntryChoiceCardProps {
  config: AssistantConfig;
  onChoice: (choice: "trial" | "enroll") => void;
}

export function EntryChoiceCard({ config, onChoice }: EntryChoiceCardProps) {
  if (!config.enrollmentEnabled) {
    return (
      <div
        style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
        className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
      >
        <p className="text-sm text-charcoal">
          Enrollment is not currently open. Please contact us to enroll.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <p className="mb-3 text-sm text-charcoal">
        How would you like to get started?
      </p>
      <div className="flex flex-col gap-2">
        {config.trialEnabled && (
          <button
            type="button"
            onClick={() => onChoice("trial")}
            style={{ borderColor: `${config.primaryColor}4D` }}
            className="w-full rounded-xl border px-4 py-3 text-left text-sm font-medium text-charcoal transition hover:opacity-80"
          >
            <span className="block text-base">Free Trial Class</span>
            <span className="text-mist">Try one class, no commitment</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onChoice("enroll")}
          style={{ backgroundColor: config.primaryColor }}
          className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-white transition hover:opacity-90"
        >
          <span className="block text-base">Enroll Now</span>
          <span className="text-white/80">Join our studio</span>
        </button>
      </div>
    </div>
  );
}
