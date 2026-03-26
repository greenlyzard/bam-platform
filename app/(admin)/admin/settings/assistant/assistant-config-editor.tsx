"use client";

import { useRef, useState, useTransition } from "react";
import { updateAssistantConfig } from "./actions";

interface Props {
  config: Record<string, any> | null;
  tenantId: string;
}

export function AssistantConfigEditor({ config, tenantId }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const [assistantName, setAssistantName] = useState(config?.assistant_name ?? "Angelina");
  const [directorName, setDirectorName] = useState(config?.director_name ?? "Miss Amanda");
  const [greeting, setGreeting] = useState(config?.greeting_message ?? "");
  const [primaryColor, setPrimaryColor] = useState(config?.primary_color ?? "#9C8BBF");
  const [enrollmentEnabled, setEnrollmentEnabled] = useState(config?.enrollment_enabled ?? true);
  const [trialEnabled, setTrialEnabled] = useState(config?.trial_enabled ?? true);
  const [avatarUrl, setAvatarUrl] = useState(config?.assistant_avatar_url ?? "");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAssistantConfig(formData);
      setStatus(result.error ? "error" : "saved");
      setTimeout(() => setStatus("idle"), 3000);
    });
  }

  const previewGreeting = greeting || `Hi! I'm ${assistantName}. How can I help you today?`;

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-charcoal">Assistant Configuration</h1>
      <p className="mt-1 text-sm text-mist">Customize the enrollment assistant for your studio</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Form */}
        <form ref={formRef} action={handleSubmit} className="space-y-5 lg:col-span-3">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="enrollment_enabled" value={String(enrollmentEnabled)} />
          <input type="hidden" name="trial_enabled" value={String(trialEnabled)} />

          <Field label="Assistant Name">
            <input name="assistant_name" value={assistantName} onChange={(e) => setAssistantName(e.target.value)}
              className="w-full rounded-md border border-silver px-3 py-2 text-sm focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20" />
          </Field>

          <Field label="Director Name">
            <input name="director_name" value={directorName} onChange={(e) => setDirectorName(e.target.value)}
              className="w-full rounded-md border border-silver px-3 py-2 text-sm focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20" />
          </Field>

          <Field label="Greeting Message">
            <textarea name="greeting_message" value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={3}
              placeholder={`Hi! I'm ${assistantName}. How can I help you today?`}
              className="w-full rounded-md border border-silver px-3 py-2 text-sm focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20" />
          </Field>

          <Field label="Primary Color">
            <div className="flex items-center gap-3">
              <input type="color" name="primary_color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-silver" />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 rounded-md border border-silver px-3 py-2 text-sm font-mono focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20" />
              <span className="h-6 w-6 rounded-full" style={{ backgroundColor: primaryColor }} />
            </div>
          </Field>

          <Field label="Avatar URL">
            <input name="assistant_avatar_url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..." className="w-full rounded-md border border-silver px-3 py-2 text-sm focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20" />
          </Field>

          <div className="flex items-center gap-8">
            <Toggle label="Enrollment Enabled" checked={enrollmentEnabled} onChange={setEnrollmentEnabled} />
            <Toggle label="Trial Enabled" checked={trialEnabled} onChange={setTrialEnabled} />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={isPending}
              className="rounded-md px-5 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}>
              {isPending ? "Saving..." : "Save"}
            </button>
            {status === "saved" && <span className="text-sm text-green-600">Configuration saved</span>}
            {status === "error" && <span className="text-sm text-red-600">Failed to save</span>}
          </div>
        </form>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-8 rounded-2xl border border-silver/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-mist">Preview</h3>
            <div className="rounded-xl border border-silver/20 bg-cream p-4">
              {/* Header bar */}
              <div className="flex items-center gap-2 rounded-t-lg px-3 py-2 text-white text-sm font-medium"
                style={{ backgroundColor: primaryColor }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                    {assistantName.charAt(0)}
                  </span>
                )}
                {assistantName}
              </div>
              {/* Chat bubble */}
              <div className="mt-3 ml-2">
                <div className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-white"
                  style={{ backgroundColor: primaryColor }}>
                  {previewGreeting}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-charcoal">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{ backgroundColor: checked ? "#9C8BBF" : "#d1d5db" }}>
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }} />
      </button>
      {label}
    </label>
  );
}
