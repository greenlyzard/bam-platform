"use client";

interface EntryChoiceCardProps {
  onChoice: (choice: "trial" | "enroll") => void;
}

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

export function EntryChoiceCard({ onChoice }: EntryChoiceCardProps) {
  return (
    <div className={cardWrapper}>
      <p className="mb-3 text-sm text-charcoal">
        How would you like to get started?
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChoice("trial")}
          className="w-full rounded-xl border border-lavender/30 px-4 py-3 text-left text-sm font-medium text-charcoal transition hover:bg-lavender/5"
        >
          <span className="block text-base">🩰 Free Trial Class</span>
          <span className="text-mist">Try one class, no commitment</span>
        </button>
        <button
          type="button"
          onClick={() => onChoice("enroll")}
          className="w-full rounded-xl bg-lavender px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-dark-lavender"
        >
          <span className="block text-base">✨ Enroll Now</span>
          <span className="text-white/80">Join our studio</span>
        </button>
      </div>
    </div>
  );
}
