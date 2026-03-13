"use client";

import { useState } from "react";

interface Module {
  id: string;
  key: string;
  label: string;
  description: string | null;
  nav_group: string;
  icon: string;
  href: string | null;
  sort_order: number;
  platform_enabled: boolean;
  tenant_enabled: boolean;
  nav_visible: boolean;
}

const GROUP_ORDER = [
  "Studio",
  "Students & Families",
  "Staff",
  "Productions",
  "Communications",
  "Settings",
];

export function ModuleControlGrid({
  initialModules,
}: {
  initialModules: Module[];
}) {
  const [modules, setModules] = useState(initialModules);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleField(
    moduleId: string,
    field: "platform_enabled" | "tenant_enabled" | "nav_visible",
    value: boolean
  ) {
    setSaving(`${moduleId}-${field}`);

    const res = await fetch("/api/platform-modules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: moduleId, [field]: value }),
    });

    if (res.ok) {
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, [field]: value } : m))
      );
    }
    setSaving(null);
  }

  // Group modules
  const grouped: Record<string, Module[]> = {};
  for (const mod of modules) {
    if (!grouped[mod.nav_group]) grouped[mod.nav_group] = [];
    grouped[mod.nav_group].push(mod);
  }

  const sortedGroups = GROUP_ORDER.filter((g) => grouped[g]);

  return (
    <div className="space-y-8">
      {sortedGroups.map((groupName) => (
        <div key={groupName}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mist mb-3">
            {groupName}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[groupName]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  saving={saving}
                  onToggle={toggleField}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModuleCard({
  module: mod,
  saving,
  onToggle,
}: {
  module: Module & { id: string };
  saving: string | null;
  onToggle: (
    id: string,
    field: "platform_enabled" | "tenant_enabled" | "nav_visible",
    value: boolean
  ) => void;
}) {
  const allOff = !mod.platform_enabled;
  const tenantOff = !mod.tenant_enabled;

  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-all ${
        allOff
          ? "border-silver/50 opacity-60"
          : tenantOff
          ? "border-silver opacity-80"
          : "border-silver"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl leading-none text-lavender">{mod.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-charcoal">{mod.label}</p>
          {mod.description && (
            <p className="text-xs text-mist mt-0.5 line-clamp-2">
              {mod.description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-silver">
        <ToggleRow
          label="Platform"
          checked={mod.platform_enabled}
          saving={saving === `${mod.id}-platform_enabled`}
          onChange={(v) => onToggle(mod.id, "platform_enabled", v)}
        />
        <ToggleRow
          label="Tenant"
          checked={mod.tenant_enabled}
          disabled={!mod.platform_enabled}
          saving={saving === `${mod.id}-tenant_enabled`}
          onChange={(v) => onToggle(mod.id, "tenant_enabled", v)}
        />
        <ToggleRow
          label="Nav"
          checked={mod.nav_visible}
          disabled={!mod.platform_enabled || !mod.tenant_enabled}
          saving={saving === `${mod.id}-nav_visible`}
          onChange={(v) => onToggle(mod.id, "nav_visible", v)}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  saving,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  saving?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-xs font-medium ${
          disabled ? "text-mist" : "text-slate"
        }`}
      >
        {label}
      </span>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled || saving}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          disabled
            ? "bg-silver/50 cursor-not-allowed"
            : checked
            ? "bg-lavender"
            : "bg-silver"
        } ${saving ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
