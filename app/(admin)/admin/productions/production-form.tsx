"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleSelect } from "@/components/ui/select";
import { createProduction, updateProduction } from "./actions";

interface ProductionData {
  id?: string;
  name: string;
  production_type: string;
  season: string | null;
  performance_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_directions: string | null;
  call_time: string | null;
  start_time: string | null;
  end_time: string | null;
  competition_org: string | null;
  competition_division: string | null;
  notes: string | null;
}

export function ProductionForm({ production }: { production?: ProductionData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [productionType, setProductionType] = useState(
    production?.production_type ?? "recital"
  );
  const [showCompetition, setShowCompetition] = useState(
    production?.production_type === "competition" || production?.production_type === "mixed"
  );
  const isEdit = !!production?.id;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateProduction(production!.id!, formData)
      : await createProduction(formData);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (!isEdit && "id" in result) {
      router.push(`/admin/productions/${result.id}`);
    } else {
      router.refresh();
    }
  }

  function handleTypeChange(val: string) {
    setProductionType(val);
    setShowCompetition(val === "competition" || val === "mixed");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-silver bg-white p-6 space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Production Name *
          </label>
          <input
            name="name"
            type="text"
            required
            defaultValue={production?.name ?? ""}
            placeholder="2026 Spring Recital — Sylvia"
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Type *
          </label>
          <input type="hidden" name="production_type" value={productionType} />
          <SimpleSelect
            value={productionType}
            onValueChange={handleTypeChange}
            options={[
              { value: "recital", label: "Recital" },
              { value: "showcase", label: "Showcase" },
              { value: "competition", label: "Competition" },
              { value: "mixed", label: "Mixed (Recital + Competition)" },
            ]}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Season
          </label>
          <input
            name="season"
            type="text"
            defaultValue={production?.season ?? "2025-2026"}
            placeholder="2025-2026"
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        {showCompetition && (
          <>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Competition Organization
              </label>
              <input
                name="competition_org"
                type="text"
                defaultValue={production?.competition_org ?? ""}
                placeholder="Spotlight, YAGP, etc."
                className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Division
              </label>
              <input
                name="competition_division"
                type="text"
                defaultValue={production?.competition_division ?? ""}
                placeholder="Junior, Teen, Senior"
                className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Performance Date
          </label>
          <input
            name="performance_date"
            type="date"
            defaultValue={production?.performance_date ?? ""}
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Call Time
          </label>
          <input
            name="call_time"
            type="time"
            defaultValue={production?.call_time ?? ""}
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Show Start
          </label>
          <input
            name="start_time"
            type="time"
            defaultValue={production?.start_time ?? ""}
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Show End (estimated)
          </label>
          <input
            name="end_time"
            type="time"
            defaultValue={production?.end_time ?? ""}
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Venue Name
          </label>
          <input
            name="venue_name"
            type="text"
            defaultValue={production?.venue_name ?? ""}
            placeholder="San Juan Hills High School"
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Venue Address
          </label>
          <input
            name="venue_address"
            type="text"
            defaultValue={production?.venue_address ?? ""}
            placeholder="29211 Vista Montana, San Juan Capistrano, CA 92675"
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Venue Directions
          </label>
          <input
            name="venue_directions"
            type="text"
            defaultValue={production?.venue_directions ?? ""}
            placeholder="Parking notes, entrance info"
            className="w-full h-10 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-charcoal mb-1.5">
            Notes
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={production?.notes ?? ""}
            className="w-full rounded-lg border border-silver px-3 py-2 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="/admin/productions"
          className="h-10 rounded-lg border border-silver text-sm font-medium px-5 flex items-center hover:bg-cloud transition-colors text-slate"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 flex items-center transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Production"}
        </button>
      </div>
    </form>
  );
}
