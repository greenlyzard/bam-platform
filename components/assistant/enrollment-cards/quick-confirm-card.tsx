"use client";

import { useState } from "react";
import type { AssistantConfig } from "@/lib/assistant/config";

interface QuickConfirmCardProps {
  config: AssistantConfig;
  studentName: string;
  className: string;
  dayTime: string;
  price: number;
  emergencyContactName: string;
  savedCardLast4: string | null;
  onConfirm: () => void;
}

export function QuickConfirmCard({
  config,
  studentName,
  className,
  dayTime,
  price,
  emergencyContactName,
  savedCardLast4,
  onConfirm,
}: QuickConfirmCardProps) {
  const [useSavedCard, setUseSavedCard] = useState(!!savedCardLast4);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const canConfirm = termsAccepted && (!savedCardLast4 || useSavedCard);

  const wrapperStyle = {
    "--assistant-color": config.primaryColor,
  } as React.CSSProperties;

  return (
    <div
      style={wrapperStyle}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <h3 className="mb-3 text-sm font-bold text-charcoal">
        Confirm Enrollment
      </h3>

      {/* Summary */}
      <div className="mb-4 space-y-2 rounded-lg bg-cream p-3">
        <div className="flex justify-between text-xs">
          <span className="text-mist">Student</span>
          <span className="font-medium text-charcoal">{studentName}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-mist">Class</span>
          <span className="font-medium text-charcoal">{className}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-mist">Day &amp; Time</span>
          <span className="font-medium text-charcoal">{dayTime}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-mist">Monthly</span>
          <span className="font-medium text-charcoal">${price}/mo</span>
        </div>
      </div>

      {/* Emergency contact */}
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-mist">
          Emergency contact on file:{" "}
          <span className="font-medium text-charcoal">
            {emergencyContactName}
          </span>
        </span>
        <a
          href="/portal/settings"
          style={{ color: config.primaryColor }}
          className="font-medium hover:underline"
        >
          Update
        </a>
      </div>

      {/* Saved card option */}
      {savedCardLast4 && (
        <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg border border-silver p-2.5">
          <input
            type="checkbox"
            checked={useSavedCard}
            onChange={(e) => setUseSavedCard(e.target.checked)}
            style={{ accentColor: config.primaryColor }}
            className="h-4 w-4 rounded"
          />
          <span className="text-xs text-charcoal">
            Charge to card ending in{" "}
            <span className="font-medium">{savedCardLast4}</span>
          </span>
        </label>
      )}

      {/* Terms checkbox */}
      <label className="mb-4 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          style={{ accentColor: config.primaryColor }}
          className="mt-0.5 h-4 w-4 rounded"
        />
        <span className="text-xs text-mist">
          I agree to the studio&apos;s enrollment terms, cancellation policy,
          and authorize recurring monthly billing.
        </span>
      </label>

      {/* Confirm button */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={!canConfirm}
        style={{ backgroundColor: config.primaryColor }}
        className="h-10 w-full rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        Confirm Enrollment
      </button>
    </div>
  );
}
