"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleSelect } from "@/components/ui/select";

interface EmbedFormData {
  name: string;
  display_mode: string;
  default_days: number[] | null;
  default_levels: string[] | null;
  default_class_types: string[] | null;
  default_age_min: number | null;
  default_age_max: number | null;
  show_trials_only: boolean;
  show_rehearsals: boolean;
  allow_filter_season: boolean;
  allow_filter_day: boolean;
  allow_filter_level: boolean;
  allow_filter_age: boolean;
  allow_filter_class_type: boolean;
  allow_filter_teacher: boolean;
  allow_filter_trial: boolean;
  allow_filter_rehearsal: boolean;
  show_teacher: boolean;
  show_room: boolean;
  show_capacity: boolean;
}

const LEVELS = ["petite", "beginner", "intermediate", "advanced", "pre_professional", "open"];
const CLASS_TYPES = ["ballet", "jazz", "contemporary", "hip_hop", "musical_theatre", "pointe", "conditioning"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EmbedForm({
  initialData,
  embedId,
  embedToken,
}: {
  initialData?: Partial<EmbedFormData>;
  embedId?: string;
  embedToken?: string;
}) {
  const router = useRouter();
  const isEdit = !!embedId;

  const [form, setForm] = useState<EmbedFormData>({
    name: initialData?.name ?? "",
    display_mode: initialData?.display_mode ?? "week",
    default_days: initialData?.default_days ?? null,
    default_levels: initialData?.default_levels ?? null,
    default_class_types: initialData?.default_class_types ?? null,
    default_age_min: initialData?.default_age_min ?? null,
    default_age_max: initialData?.default_age_max ?? null,
    show_trials_only: initialData?.show_trials_only ?? false,
    show_rehearsals: initialData?.show_rehearsals ?? false,
    allow_filter_season: initialData?.allow_filter_season ?? false,
    allow_filter_day: initialData?.allow_filter_day ?? true,
    allow_filter_level: initialData?.allow_filter_level ?? true,
    allow_filter_age: initialData?.allow_filter_age ?? true,
    allow_filter_class_type: initialData?.allow_filter_class_type ?? true,
    allow_filter_teacher: initialData?.allow_filter_teacher ?? false,
    allow_filter_trial: initialData?.allow_filter_trial ?? true,
    allow_filter_rehearsal: initialData?.allow_filter_rehearsal ?? false,
    show_teacher: initialData?.show_teacher ?? true,
    show_room: initialData?.show_room ?? false,
    show_capacity: initialData?.show_capacity ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/admin/schedule-embeds/${embedId}`
        : "/api/admin/schedule-embeds";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to save");
      }

      router.push("/admin/schedule-embeds");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = <T extends string | number>(
    key: keyof EmbedFormData,
    value: T
  ) => {
    setForm((prev) => {
      const current = (prev[key] as T[] | null) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next.length > 0 ? next : null };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-3">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Embed Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g., Homepage Schedule"
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:outline-none focus:border-lavender"
          required
        />
      </div>

      {/* Display Mode */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Display Mode
        </label>
        <SimpleSelect
          value={form.display_mode}
          onValueChange={(val) => setForm((f) => ({ ...f, display_mode: val }))}
          options={[
            { value: "week", label: "Week" },
            { value: "list", label: "List" },
            { value: "day", label: "Day" },
          ]}
        />
      </div>

      {/* Default Days */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          Default Days
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleArrayItem("default_days", idx + 1)}
              className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                (form.default_days ?? []).includes(idx + 1)
                  ? "bg-lavender text-white border-lavender"
                  : "border-silver text-slate hover:bg-cloud"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Default Levels */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          Default Levels
        </label>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => toggleArrayItem("default_levels", lv)}
              className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                (form.default_levels ?? []).includes(lv)
                  ? "bg-lavender text-white border-lavender"
                  : "border-silver text-slate hover:bg-cloud"
              }`}
            >
              {lv.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Default Class Types */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          Default Class Types
        </label>
        <div className="flex flex-wrap gap-2">
          {CLASS_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleArrayItem("default_class_types", t)}
              className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                (form.default_class_types ?? []).includes(t)
                  ? "bg-lavender text-white border-lavender"
                  : "border-silver text-slate hover:bg-cloud"
              }`}
            >
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles: defaults */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-charcoal">Defaults</p>
        <ToggleRow
          label="Show trials only"
          checked={form.show_trials_only}
          onChange={(v) => setForm((f) => ({ ...f, show_trials_only: v }))}
        />
        <ToggleRow
          label="Show rehearsals"
          checked={form.show_rehearsals}
          onChange={(v) => setForm((f) => ({ ...f, show_rehearsals: v }))}
        />
        <ToggleRow
          label="Show teacher names"
          checked={form.show_teacher}
          onChange={(v) => setForm((f) => ({ ...f, show_teacher: v }))}
        />
        <ToggleRow
          label="Show room names"
          checked={form.show_room}
          onChange={(v) => setForm((f) => ({ ...f, show_room: v }))}
        />
        <ToggleRow
          label="Show capacity"
          checked={form.show_capacity}
          onChange={(v) => setForm((f) => ({ ...f, show_capacity: v }))}
        />
      </div>

      {/* Filter Permissions */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-charcoal">
          Parent Filter Permissions
        </p>
        <ToggleRow
          label="Allow filter: Season"
          checked={form.allow_filter_season}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_season: v }))}
        />
        <ToggleRow
          label="Allow filter: Day"
          checked={form.allow_filter_day}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_day: v }))}
        />
        <ToggleRow
          label="Allow filter: Level"
          checked={form.allow_filter_level}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_level: v }))}
        />
        <ToggleRow
          label="Allow filter: Age Range"
          checked={form.allow_filter_age}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_age: v }))}
        />
        <ToggleRow
          label="Allow filter: Class Type"
          checked={form.allow_filter_class_type}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_class_type: v }))}
        />
        <ToggleRow
          label="Allow filter: Teacher"
          checked={form.allow_filter_teacher}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_teacher: v }))}
        />
        <ToggleRow
          label="Allow filter: Trial Toggle"
          checked={form.allow_filter_trial}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_trial: v }))}
        />
        <ToggleRow
          label="Allow filter: Rehearsal Toggle"
          checked={form.allow_filter_rehearsal}
          onChange={(v) => setForm((f) => ({ ...f, allow_filter_rehearsal: v }))}
        />
      </div>

      {/* Iframe Preview */}
      {isEdit && embedToken && (
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Embed Code
          </label>
          <pre className="rounded-lg bg-cloud p-3 text-xs text-slate overflow-x-auto">
            {`<iframe src="https://portal.balletacademyandmovement.com/widget/schedule/${embedToken}" width="100%" height="700" frameborder="0" style="border:none;" title="Class Schedule — Ballet Academy and Movement"></iframe>`}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-lavender px-6 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update Embed" : "Create Embed"}
        </button>
        <a
          href="/admin/schedule-embeds"
          className="rounded-lg border border-silver px-6 py-2 text-sm font-medium text-slate hover:bg-cloud transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-silver text-lavender accent-lavender"
      />
      <span className="text-sm text-slate">{label}</span>
    </label>
  );
}
