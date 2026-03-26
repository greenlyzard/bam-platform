"use client";

import { useState } from "react";

// TODO: Persist these settings to a tenant_settings table in the DB.
// For now they are client-only state and reset on page reload.

export default function EnrollmentSettingsPage() {
  const [reEnrollBanner, setReEnrollBanner] = useState(true);
  const [allowLevelUp, setAllowLevelUp] = useState(true);
  const [levelUpApproval, setLevelUpApproval] = useState(true);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-heading font-semibold text-charcoal mb-6">
        Enrollment Settings
      </h1>

      <div className="space-y-6">
        <ToggleRow
          label="Re-Enrollment Banner"
          description="Show a seasonal re-enrollment banner on the parent dashboard."
          checked={reEnrollBanner}
          onChange={setReEnrollBanner}
        />
        <ToggleRow
          label="Allow Parent Level-Up Requests"
          description="Parents can request a class level change for their dancer from the portal."
          checked={allowLevelUp}
          onChange={setAllowLevelUp}
        />
        <ToggleRow
          label="Level Up Requires Teacher Approval"
          description="Level-up requests must be approved by a teacher or admin before taking effect."
          checked={levelUpApproval}
          onChange={setLevelUpApproval}
        />
      </div>

      <p className="mt-8 text-xs text-slate">
        These settings are not yet persisted to the database. Changes will reset on page reload.
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-silver bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-charcoal">{label}</p>
        <p className="text-xs text-slate mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-lavender" : "bg-gray-300"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
