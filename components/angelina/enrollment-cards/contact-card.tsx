"use client";

import { useState } from "react";

interface ContactCardProps {
  onComplete: (data: {
    phone: string;
    smsOptIn: boolean;
    emergencyName: string;
    emergencyPhone: string;
    referralSource: string;
  }) => void;
}

const REFERRAL_OPTIONS = [
  { value: "", label: "Select one..." },
  { value: "google", label: "Google Search" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "friend", label: "Friend or Family" },
  { value: "drive_by", label: "Drove Past the Studio" },
  { value: "event", label: "Community Event" },
  { value: "yelp", label: "Yelp" },
  { value: "other", label: "Other" },
];

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

export function ContactCard({ onComplete }: ContactCardProps) {
  const [phone, setPhone] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [referralSource, setReferralSource] = useState("");

  const inputClass =
    "h-9 w-full rounded-lg border border-silver px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onComplete({ phone, smsOptIn, emergencyName, emergencyPhone, referralSource });
  }

  return (
    <div className={cardWrapper}>
      <p className="mb-3 text-sm font-medium text-charcoal">
        A few more details
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-charcoal">
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="(949) 555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-mist">
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(e) => setSmsOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
          />
          <span>
            By checking this box, you agree to receive text messages from Ballet
            Academy and Movement at the number provided. Message and data rates
            may apply. Text STOP to opt out.
          </span>
        </label>

        <div className="border-t border-silver/50 pt-3">
          <p className="mb-2 text-xs font-medium text-charcoal">
            Emergency Contact
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Emergency Contact Name"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="tel"
              placeholder="Emergency Contact Phone"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-charcoal">
            How did you hear about us?
          </label>
          <select
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            className="appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 cursor-pointer w-full"
          >
            {REFERRAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!phone || !emergencyName || !emergencyPhone}
          className="h-9 w-full rounded-lg bg-lavender text-sm font-medium text-white transition hover:bg-dark-lavender disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
