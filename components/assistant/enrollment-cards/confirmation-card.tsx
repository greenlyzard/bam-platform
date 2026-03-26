"use client";

import type { AssistantConfig } from "@/lib/assistant/config";

interface ConfirmationCardProps {
  config: AssistantConfig;
  studentName: string;
  className: string;
  dayTime: string;
  studioAddress: string;
  studioName: string;
}

function generateICS(
  className: string,
  dayTime: string,
  address: string,
  studioName: string
): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + ((7 - nextWeek.getDay()) % 7 || 7));
  const dtStart =
    nextWeek.toISOString().replace(/[-:]/g, "").split("T")[0] + "T170000";
  const dtEnd =
    nextWeek.toISOString().replace(/[-:]/g, "").split("T")[0] + "T180000";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${studioName}//Enrollment//EN`,
    "BEGIN:VEVENT",
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${className}`,
    `LOCATION:${address}`,
    `DESCRIPTION:Your first class at ${studioName}! ${dayTime}`,
    `DTSTAMP:${timestamp}`,
    `UID:${crypto.randomUUID()}@enrollment`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(
  className: string,
  dayTime: string,
  address: string,
  studioName: string
) {
  const icsContent = generateICS(className, dayTime, address, studioName);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${className.replace(/\s+/g, "-").toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ConfirmationCard({
  config,
  studentName,
  className,
  dayTime,
  studioAddress,
  studioName,
}: ConfirmationCardProps) {
  return (
    <div
      style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <div className="mb-3 text-center">
        <h3 className="mt-1 text-lg font-bold text-charcoal">
          You&apos;re in!
        </h3>
        <p className="text-sm text-mist">
          {config.directorName} and the team can&apos;t wait to meet {studentName}!
        </p>
      </div>

      <div className="mb-4 space-y-2 rounded-lg bg-cream p-3">
        <div className="flex justify-between text-xs">
          <span className="text-mist">Class</span>
          <span className="font-medium text-charcoal">{className}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-mist">Day &amp; Time</span>
          <span className="font-medium text-charcoal">{dayTime}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-mist">Location</span>
          <span className="font-medium text-charcoal">{studioAddress}</span>
        </div>
      </div>

      <p className="mb-3 text-xs text-mist">
        Dress code information will be sent to your email. Check your inbox for
        a confirmation with all the details.
      </p>

      <button
        type="button"
        onClick={() => downloadICS(className, dayTime, studioAddress, studioName)}
        style={{ borderColor: config.primaryColor, color: config.primaryColor }}
        className="h-9 w-full rounded-lg border text-sm font-medium transition hover:opacity-80"
      >
        Add to Calendar
      </button>
    </div>
  );
}
