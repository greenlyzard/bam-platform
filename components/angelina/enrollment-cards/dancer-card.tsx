"use client";

import { useState } from "react";

interface DancerCardProps {
  onComplete: (student: {
    firstName: string;
    lastName: string;
    dob: string;
    age: number;
  }) => void;
}

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function DancerCard({ onComplete }: DancerCardProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");

  const inputClass =
    "h-9 w-full rounded-lg border border-silver px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const age = calculateAge(dob);
    onComplete({ firstName, lastName, dob, age });
  }

  return (
    <div className={cardWrapper}>
      <p className="mb-3 text-sm font-medium text-charcoal">
        Tell me about your dancer
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
          className={inputClass}
        />
        {dob && (
          <p className="text-xs text-mist">
            Age: {calculateAge(dob)} years old
          </p>
        )}
        <button
          type="submit"
          disabled={!firstName || !lastName || !dob}
          className="h-9 w-full rounded-lg bg-lavender text-sm font-medium text-white transition hover:bg-dark-lavender disabled:opacity-50"
        >
          Add Dancer
        </button>
      </form>
    </div>
  );
}
