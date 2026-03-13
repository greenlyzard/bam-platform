"use client";

import { useState } from "react";
import { updatePayRate } from "./actions";

interface Teacher {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  classRateCents: number | null;
  privateRateCents: number | null;
  rehearsalRateCents: number | null;
  adminRateCents: number | null;
}

function centsToStr(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function PayRateEditor({ teachers }: { teachers: Teacher[] }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    teacherId: string;
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSave(formData: FormData) {
    const teacherId = formData.get("teacherId") as string;
    setSaving(teacherId);
    setMessage(null);

    const result = await updatePayRate(formData);
    setSaving(null);

    if (result?.error) {
      setMessage({ teacherId, type: "error", text: result.error });
    } else {
      setMessage({ teacherId, type: "success", text: "Saved" });
      setTimeout(() => setMessage(null), 2000);
    }
  }

  return (
    <div className="space-y-4">
      {teachers.map((t) => {
        const name =
          [t.firstName, t.lastName].filter(Boolean).join(" ") || "Unnamed";
        const isSaving = saving === t.id;
        const msg = message?.teacherId === t.id ? message : null;

        return (
          <form key={t.id} action={handleSave}>
            <input type="hidden" name="teacherId" value={t.id} />
            <div className="rounded-xl border border-silver bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-charcoal">{name}</h3>
                  {t.email && (
                    <p className="text-xs text-slate">{t.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {msg && (
                    <span
                      className={`text-xs font-medium ${
                        msg.type === "success" ? "text-success" : "text-error"
                      }`}
                    >
                      {msg.text}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-4 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <RateField
                  label="Class Rate"
                  name="classRate"
                  defaultValue={centsToStr(t.classRateCents)}
                />
                <RateField
                  label="Private Rate"
                  name="privateRate"
                  defaultValue={centsToStr(t.privateRateCents)}
                />
                <RateField
                  label="Rehearsal Rate"
                  name="rehearsalRate"
                  defaultValue={centsToStr(t.rehearsalRateCents)}
                />
                <RateField
                  label="Admin Rate"
                  name="adminRate"
                  defaultValue={centsToStr(t.adminRateCents)}
                />
              </div>
            </div>
          </form>
        );
      })}
    </div>
  );
}

function RateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium text-slate mb-1"
      >
        {label} ($/hr)
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={defaultValue}
        required
        className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
      />
    </div>
  );
}
