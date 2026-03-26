"use client";

import { useState } from "react";

interface TermsCardProps {
  onAccept: () => void;
}

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

const KEY_TERMS = [
  "Monthly tuition is due on the 1st of each month and covers 4 weeks of instruction.",
  "A 30-day written notice is required to withdraw from classes.",
  "Missed classes may be made up within the same month, subject to availability.",
  "Costumes, competition fees, and special event fees are billed separately.",
  "The studio reserves the right to photograph or video students for promotional use unless a written opt-out is on file.",
  "Students must follow the studio dress code. Details will be provided upon enrollment.",
];

const FULL_TERMS = `Ballet Academy and Movement Enrollment Terms and Conditions

1. ENROLLMENT & TUITION
Monthly tuition is billed automatically on the 1st of each month. Tuition rates are based on the number of classes per week and are published on our website. A non-refundable annual registration fee is charged at the time of enrollment and each August thereafter.

2. WITHDRAWAL POLICY
A 30-day written notice is required to withdraw from any class. Tuition is non-refundable. Early withdrawal does not entitle a family to a prorated refund for the remaining month.

3. MAKE-UP CLASSES
Students may make up missed classes within the same calendar month, subject to space availability. Make-up classes do not carry over to the following month.

4. ATTENDANCE & CONDUCT
Regular attendance is expected. Students who miss more than 3 consecutive classes without notice may lose their spot. All students and families are expected to maintain respectful behavior toward staff, fellow students, and studio property.

5. MEDIA RELEASE
Ballet Academy and Movement may photograph or video record classes, performances, and events for promotional purposes. Families who wish to opt out must submit a written request.

6. LIABILITY WAIVER
Ballet Academy and Movement, its owners, instructors, and staff are not responsible for injuries sustained during classes, rehearsals, or performances. Families acknowledge that dance involves physical activity and inherent risk.

7. DRESS CODE
Students are required to follow the studio dress code for their level. Dress code details are provided upon enrollment and are available on our website.

8. ADDITIONAL FEES
Costume fees, competition fees, and special event participation fees are billed separately and communicated in advance.`;

export function TermsCard({ onAccept }: TermsCardProps) {
  const [agreed, setAgreed] = useState(false);
  const [showFull, setShowFull] = useState(false);

  return (
    <div className={cardWrapper}>
      <p className="mb-3 text-sm font-medium text-charcoal">
        Enrollment Terms
      </p>

      <ul className="mb-3 space-y-2">
        {KEY_TERMS.map((term, i) => (
          <li key={i} className="flex gap-2 text-xs text-mist">
            <span className="mt-0.5 shrink-0 text-lavender">•</span>
            <span>{term}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setShowFull(!showFull)}
        className="mb-3 text-xs font-medium text-lavender hover:underline"
      >
        {showFull ? "Hide full terms" : "Read full terms"}
      </button>

      {showFull && (
        <div className="mb-3 max-h-48 overflow-y-auto rounded-lg bg-cream p-3 text-xs text-mist whitespace-pre-wrap">
          {FULL_TERMS}
        </div>
      )}

      <label className="mb-3 flex items-start gap-2 text-xs text-charcoal">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
        />
        <span>I agree to the enrollment terms and conditions</span>
      </label>

      <button
        type="button"
        onClick={onAccept}
        disabled={!agreed}
        className="h-9 w-full rounded-lg bg-lavender text-sm font-medium text-white transition hover:bg-dark-lavender disabled:opacity-50"
      >
        Accept &amp; Continue
      </button>
    </div>
  );
}
