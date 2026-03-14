"use client";

import { useEffect, useState } from "react";

export default function AngelinaSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/angelina-toggle")
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    const newValue = !enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/angelina-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (res.ok) {
        setEnabled(newValue);
      }
    } catch {
      // revert on failure
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl">
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Angelina Settings
        </h1>
        <p className="mt-4 text-sm text-mist">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <a
          href="/admin/settings"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Settings
        </a>
        <h1 className="mt-2 font-heading text-2xl font-bold text-charcoal">
          Angelina Settings
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage the Angelina AI assistant for your studio.
        </p>
      </div>

      <div className="rounded-xl border border-silver bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-charcoal">
              Enable Angelina
            </h3>
            <p className="text-xs text-mist mt-0.5">
              When disabled, the AI chat assistant will be hidden for all users.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            role="switch"
            aria-checked={enabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled ? "bg-lavender" : "bg-silver"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {!enabled && (
          <p className="mt-3 text-xs text-warning font-medium">
            Angelina is currently disabled. The chat widget will not appear for
            any user.
          </p>
        )}
      </div>
    </div>
  );
}
