"use client";

interface WaitlistCardProps {
  className: string;
  onJoin: () => void;
}

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

export function WaitlistCard({ className, onJoin }: WaitlistCardProps) {
  return (
    <div className={cardWrapper}>
      <div className="mb-3 text-center">
        <p className="text-sm text-charcoal">
          <span className="font-medium">{className}</span> is currently full,
          but we&apos;d love to save you a spot as soon as one opens up.
        </p>
      </div>

      <button
        type="button"
        onClick={onJoin}
        className="h-9 w-full rounded-lg bg-lavender text-sm font-medium text-white transition hover:bg-dark-lavender"
      >
        Join Waitlist for {className}
      </button>

      <p className="mt-2 text-center text-[10px] text-mist">
        We&apos;ll notify you by email as soon as a spot opens.
      </p>
    </div>
  );
}
