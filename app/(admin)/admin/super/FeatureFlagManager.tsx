"use client";

import { useState, useEffect } from "react";

const FLAG_LABELS: Record<string, string> = {
  compliance: "Compliance",
  substitute_requests: "Substitute Requests",
  productions: "Productions",
  email_templates: "Email Templates",
  schedule_embeds: "Schedule Embeds",
  announcements: "Announcements",
  tasks: "Tasks",
  calendar: "Calendar",
  seasons: "Seasons",
  schedule_classes: "Schedule Classes",
};

export function FeatureFlagManager() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/feature-flags");
      if (res.ok) {
        const json = await res.json();
        setFlags(json.flags);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function toggle(key: string) {
    setToggling(key);
    const newValue = !flags[key];

    await fetch("/api/feature-flags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, is_enabled: newValue }),
    });

    setFlags((prev) => ({ ...prev, [key]: newValue }));
    setToggling(null);
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-mist">
        Loading feature flags...
      </div>
    );
  }

  const sortedKeys = Object.keys(flags).sort();

  return (
    <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
      <div className="px-5 py-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">
          Feature Flags
        </h2>
        <p className="text-xs text-mist mt-0.5">
          Disabled features are hidden from all users except derek@greenlyzard.com
        </p>
      </div>
      {sortedKeys.map((key) => (
        <div
          key={key}
          className="flex items-center justify-between px-5 py-3"
        >
          <div>
            <p className="text-sm font-medium text-charcoal">
              {FLAG_LABELS[key] ?? key}
            </p>
            <p className="text-xs text-mist">{key}</p>
          </div>
          <button
            onClick={() => toggle(key)}
            disabled={toggling === key}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              flags[key] ? "bg-lavender" : "bg-silver"
            } ${toggling === key ? "opacity-50" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                flags[key] ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
