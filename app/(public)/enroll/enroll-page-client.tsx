"use client";

import { useState } from "react";
import Link from "next/link";
import { EnrollmentChat } from "@/components/assistant/enrollment-chat";
import { EnrollmentWizard } from "./enrollment-wizard";
import { ClassCatalog } from "./classes/class-catalog";
import {
  StudentSelectionCard,
  type StudentOption,
} from "@/components/assistant/enrollment-cards/student-selection-card";
import { useCart } from "@/lib/cart-context";
import type { AssistantConfig } from "@/lib/assistant/config";

interface EnrollPageClientProps {
  classes: any[];
  config: AssistantConfig;
  studioName: string;
  tenantId: string;
  /** Signed-in parent's existing active students (empty for guests/new families). */
  initialStudents?: StudentOption[];
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

export function EnrollPageClient({
  classes,
  config,
  studioName,
  tenantId,
  initialStudents = [],
}: EnrollPageClientProps) {
  const [preferForm, setPreferForm] = useState(false);
  // Returning-family fork: hoisted above the chat/wizard split so a signed-in
  // parent picks an existing dancer first, then adds classes straight to the
  // Slice-1 cart. "Add a new dancer" drops back into the normal chat/wizard.
  const [addingNewDancer, setAddingNewDancer] = useState(false);
  const [pickedStudent, setPickedStudent] = useState<{ id: string; name: string } | null>(null);
  const cart = useCart();

  const showReturningFamily = initialStudents.length > 0 && !addingNewDancer;

  function addExistingStudentClass(classId: string) {
    if (!pickedStudent) return;
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    cart.addItem({
      classInfo: cls,
      childName: pickedStudent.name,
      childAge: null,
      studentId: pickedStudent.id,
      type: cls.isFull ? "waitlist" : "enroll",
    });
  }

  if (showReturningFamily) {
    // Step 1: pick which existing dancer to enroll.
    if (!pickedStudent) {
      return (
        <div className="mx-auto max-w-md">
          <StudentSelectionCard
            config={config}
            students={initialStudents}
            onSelect={(studentId) => {
              const s = initialStudents.find((x) => x.id === studentId);
              if (s) setPickedStudent({ id: s.id, name: `${s.firstName} ${s.lastName}` });
            }}
            onAddNew={() => setAddingNewDancer(true)}
          />
        </div>
      );
    }

    // Step 2: pick classes for that dancer — reuse the /enroll/classes catalog in
    // add-to-cart mode. The cart hands off to Slice-1 consent/checkout unchanged.
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-charcoal">
              Enrolling {pickedStudent.name}
            </h2>
            <button
              type="button"
              onClick={() => setPickedStudent(null)}
              style={{ color: config.primaryColor }}
              className="text-sm hover:underline"
            >
              &larr; Choose a different dancer
            </button>
          </div>
          <Link
            href="/enroll/cart"
            className="h-10 shrink-0 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 flex items-center transition-colors"
          >
            View cart{cart.itemCount > 0 ? ` (${cart.itemCount})` : ""} &rarr;
          </Link>
        </div>

        <ClassCatalog classes={classes} onEnroll={addExistingStudentClass} />
      </div>
    );
  }

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
