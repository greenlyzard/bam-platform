"use client";

import { useState, useTransition } from "react";
import { updateClassFieldVisibility } from "./actions";

interface FieldConfig {
  id: string;
  tenant_id: string;
  field_key: string;
  label: string;
  field_type: string;
  admin_visible: boolean;
  admin_default_on: boolean;
  parent_visible: boolean;
  adult_student_visible: boolean;
  child_portal_visible: boolean;
  public_visible: boolean;
  sort_order: number;
  group_name: string;
  is_core: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMN_DEFS = [
  { key: "parent_visible", label: "Parent Portal" },
  { key: "adult_student_visible", label: "Adult Student" },
  { key: "child_portal_visible", label: "Child Portal" },
  { key: "public_visible", label: "Public Widget" },
  { key: "admin_default_on", label: "Admin Default On" },
] as const;

const GROUP_ORDER = [
  "Basic Info",
  "Scheduling",
  "Enrollment",
  "Billing",
  "Descriptions",
  "Type Flags",
];

export function ClassFieldSettings({
  fields,
  tenantId,
}: {
  fields: FieldConfig[];
  tenantId: string;
}) {
  const [local, setLocal] = useState<FieldConfig[]>(fields);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function handleToggle(fieldKey: string, column: string, current: boolean) {
    const next = !current;

    // Optimistic update
    setLocal((prev) =>
      prev.map((f) =>
        f.field_key === fieldKey ? { ...f, [column]: next } : f
      )
    );

    const fd = new FormData();
    fd.set("fieldKey", fieldKey);
    fd.set("column", column);
    fd.set("value", String(next));
    fd.set("tenantId", tenantId);

    startTransition(async () => {
      const result = await updateClassFieldVisibility(fd);
      if (result.error) {
        // Revert on error
        setLocal((prev) =>
          prev.map((f) =>
            f.field_key === fieldKey ? { ...f, [column]: current } : f
          )
        );
        showToast("Error: " + result.error);
      } else {
        showToast("Saved");
      }
    });
  }

  // Group fields
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    rows: local.filter((f) => f.group_name === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 shadow-md">
          {toast}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-silver bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-silver bg-cloud/50">
              <th className="px-4 py-3 text-left font-medium text-charcoal">
                Field
              </th>
              {COLUMN_DEFS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-center font-medium text-charcoal whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ group, rows }) => (
              <GroupSection
                key={group}
                group={group}
                rows={rows}
                onToggle={handleToggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupSection({
  group,
  rows,
  onToggle,
}: {
  group: string;
  rows: FieldConfig[];
  onToggle: (fieldKey: string, column: string, current: boolean) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={6}
          className="px-4 pt-4 pb-1 text-xs uppercase tracking-wider font-semibold text-mist"
        >
          {group}
        </td>
      </tr>
      {rows.map((field) => (
        <tr
          key={field.field_key}
          className="border-t border-silver/50 hover:bg-cream/30"
        >
          <td className="px-4 py-2.5 text-charcoal">
            <span className="flex items-center gap-1.5">
              {field.label}
              {field.is_core && (
                <span className="text-mist text-xs" title="Core field — locked">
                  &#x1F512;
                </span>
              )}
            </span>
          </td>
          {COLUMN_DEFS.map((col) => (
            <td key={col.key} className="px-3 py-2.5 text-center">
              <Toggle
                checked={field[col.key as keyof FieldConfig] as boolean}
                disabled={field.is_core}
                onChange={() =>
                  onToggle(
                    field.field_key,
                    col.key,
                    field[col.key as keyof FieldConfig] as boolean
                  )
                }
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${checked ? "bg-lavender" : "bg-silver"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
