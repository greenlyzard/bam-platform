"use client";

interface ConfirmationCardProps {
  studentName: string;
  className: string;
  dayTime: string;
  studioAddress: string;
}

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

function generateICS(
  className: string,
  dayTime: string,
  address: string
): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  // Use a near-future date for the first class
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + ((7 - nextWeek.getDay()) % 7 || 7));
  const dtStart =
    nextWeek.toISOString().replace(/[-:]/g, "").split("T")[0] + "T170000";
  const dtEnd =
    nextWeek.toISOString().replace(/[-:]/g, "").split("T")[0] + "T180000";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ballet Academy and Movement//Enrollment//EN",
    "BEGIN:VEVENT",
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${className}`,
    `LOCATION:${address}`,
    `DESCRIPTION:Your first class at Ballet Academy and Movement! ${dayTime}`,
    `DTSTAMP:${timestamp}`,
    `UID:${crypto.randomUUID()}@balletacademyandmovement.com`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(
  className: string,
  dayTime: string,
  address: string
) {
  const icsContent = generateICS(className, dayTime, address);
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
  studentName,
  className,
  dayTime,
  studioAddress,
}: ConfirmationCardProps) {
  return (
    <div className={cardWrapper}>
      <div className="mb-3 text-center">
        <span className="text-3xl">🩰</span>
        <h3 className="mt-1 text-lg font-bold text-charcoal">
          You&apos;re in!
        </h3>
        <p className="text-sm text-mist">
          {studentName} is enrolled and ready to dance.
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
        onClick={() => downloadICS(className, dayTime, studioAddress)}
        className="h-9 w-full rounded-lg border border-lavender text-sm font-medium text-lavender transition hover:bg-lavender/5"
      >
        Add to Calendar
      </button>

      <div className="mt-3 flex justify-center gap-3">
        <a
          href="https://www.instagram.com/balletacademyandmovement"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-lavender hover:underline"
        >
          Follow on Instagram
        </a>
        <a
          href="https://www.facebook.com/balletacademyandmovement"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-lavender hover:underline"
        >
          Follow on Facebook
        </a>
      </div>
    </div>
  );
}
