"use client";

import { useState } from "react";
import { EnrollmentChat } from "@/components/angelina/enrollment-chat";
import { EnrollmentWizard } from "./enrollment-wizard";

interface EnrollPageClientProps {
  classes: any[];
}

const STEPS = [
  "Get Started",
  "Create Account",
  "Dancer Info",
  "Choose Class",
  "Contact Details",
  "Terms",
  "Payment",
  "Confirmation",
];

export function EnrollPageClient({ classes }: EnrollPageClientProps) {
  const [preferForm, setPreferForm] = useState(false);

  if (preferForm) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setPreferForm(false)}
          className="mb-4 text-sm text-lavender hover:underline"
        >
          &larr; Switch to guided enrollment
        </button>
        <EnrollmentWizard classes={classes} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-right">
        <button
          type="button"
          onClick={() => setPreferForm(true)}
          className="text-sm text-mist hover:text-lavender hover:underline"
        >
          Prefer a form?
        </button>
      </div>

      {/* Mobile: full-screen chat */}
      <div className="md:hidden">
        <div className="h-[calc(100vh-200px)] rounded-2xl border border-silver/30 bg-cream">
          <EnrollmentChat />
        </div>
      </div>

      {/* Desktop: two-column layout */}
      <div className="hidden md:grid md:grid-cols-3 md:gap-8">
        <div className="col-span-2">
          <div className="h-[600px] rounded-2xl border border-silver/30 bg-cream">
            <EnrollmentChat />
          </div>
        </div>

        {/* Step progress tracker */}
        <div className="col-span-1">
          <div className="sticky top-8 rounded-2xl border border-silver/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-charcoal">
              Enrollment Progress
            </h3>
            <ol className="space-y-3">
              {STEPS.map((label, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-silver/50 text-xs text-mist">
                    {i + 1}
                  </span>
                  <span className="text-sm text-mist">{label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
