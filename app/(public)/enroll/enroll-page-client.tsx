"use client";

import { useState } from "react";
import { EnrollmentChat } from "@/components/assistant/enrollment-chat";
import { EnrollmentWizard } from "./enrollment-wizard";
import type { AssistantConfig } from "@/lib/assistant/config";

interface EnrollPageClientProps {
  classes: any[];
  config: AssistantConfig;
  studioName: string;
  tenantId: string;
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

export function EnrollPageClient({ classes, config, studioName, tenantId }: EnrollPageClientProps) {
  const [preferForm, setPreferForm] = useState(false);

  if (preferForm) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setPreferForm(false)}
          style={{ color: config.primaryColor }}
          className="mb-4 text-sm hover:underline"
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
          className="text-sm text-mist hover:underline"
          style={{ "--assistant-color": config.primaryColor } as React.CSSProperties}
        >
          Prefer a form?
        </button>
      </div>

      {/* Mobile: full-screen chat */}
      <div className="md:hidden">
        <div className="h-[calc(100vh-200px)] rounded-2xl border border-silver/30 bg-cream">
          <EnrollmentChat config={config} studioName={studioName} tenantId={tenantId} />
        </div>
      </div>

      {/* Desktop: 60/40 layout */}
      <div className="hidden md:grid md:grid-cols-5 md:gap-8">
        <div className="col-span-3">
          <div className="h-[600px] rounded-2xl border border-silver/30 bg-cream">
            <EnrollmentChat config={config} studioName={studioName} tenantId={tenantId} />
          </div>
        </div>

        {/* Step progress tracker */}
        <div className="col-span-2">
          <div className="sticky top-8 rounded-2xl border border-silver/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-charcoal">
              Enrollment Progress
            </h3>
            <ol className="space-y-3">
              {STEPS.map((label, i) => {
                const isCurrent = i === 0; // Step tracking is visual only at page level
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                      style={
                        isCurrent
                          ? { backgroundColor: config.primaryColor, color: "#fff" }
                          : { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.35)" }
                      }
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: isCurrent ? config.primaryColor : undefined }}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
