"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createSeason, updateSeason } from "./actions";

interface ProgramType {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_public: boolean;
}

interface SeasonData {
  id: string;
  name: string;
  program_type_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  is_active: boolean;
  registration_open: boolean;
}

export function SeasonEditDrawer({
  season,
  isDuplicate,
  programTypes,
  tenantId,
  onClose,
  onSaved,
}: {
  season?: SeasonData;
  isDuplicate?: boolean;
  programTypes: ProgramType[];
  tenantId: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const isEdit = !!season && !isDuplicate;
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState(
    isDuplicate && season ? `${season.name} (Copy)` : (season?.name ?? "")
  );
  const [programTypeId, setProgramTypeId] = useState(season?.program_type_id ?? "");
  const [startDate, setStartDate] = useState(season?.start_date ?? "");
  const [endDate, setEndDate] = useState(season?.end_date ?? "");
  const [isOngoing, setIsOngoing] = useState(season?.is_ongoing ?? false);
  const [isActive, setIsActive] = useState(isDuplicate ? false : (season?.is_active ?? false));
  const [registrationOpen, setRegistrationOpen] = useState(season?.registration_open ?? false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProgram = programTypes.find((p) => p.id === programTypeId);

  // Cmd+Enter to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      setLoading(true);
      setError("");

      formData.set("tenant_id", tenantId);
      formData.set("name", name);
      formData.set("program_type_id", programTypeId);
      formData.set("start_date", startDate);
      formData.set("end_date", isOngoing ? "" : endDate);
      formData.set("is_ongoing", String(isOngoing));
      formData.set("is_active", String(isActive));
      formData.set("registration_open", String(registrationOpen));

      if (isEdit && season) {
        formData.set("seasonId", season.id);
      }

      const result = isEdit ? await updateSeason(formData) : await createSeason(formData);
      setLoading(false);

      if (result?.error) {
        setError(result.error);
      } else {
        const newId = isEdit ? season!.id : (result as { id?: string }).id;
        if (newId) onSaved?.(newId);
        onClose();
      }
    },
    [isEdit, season, tenantId, name, programTypeId, startDate, endDate, isOngoing, isActive, registrationOpen, onClose, onSaved]
  );

  const title = isDuplicate ? "Duplicate Season" : isEdit ? "Edit Season" : "New Season";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-silver px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-heading font-semibold text-charcoal">{title}</h2>
          <button onClick={onClose} className="text-slate hover:text-charcoal text-lg">✕</button>
        </div>

        <form ref={formRef} action={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fall 2026 Regular"
              className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>

          {/* Program Type */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Program Type *</label>
            <SimpleSelect
              value={programTypeId}
              onValueChange={(val) => setProgramTypeId(val)}
              options={programTypes.map((pt) => ({ value: pt.id, label: pt.name }))}
              placeholder="Select program type..."
              className="w-full"
            />
            {selectedProgram && !selectedProgram.is_public && (
              <p className="mt-1.5 text-xs text-error">⚠ This program type is never public</p>
            )}
          </div>

          {/* Is Ongoing */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isOngoing}
                  onChange={(e) => setIsOngoing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </span>
              <span className="text-sm font-medium text-charcoal">Ongoing season</span>
            </label>
            <p className="mt-1 text-xs text-mist ml-11">Ongoing seasons have no end date</p>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Start Date *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>

          {/* End Date — hidden when ongoing */}
          {!isOngoing && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 rounded-md border border-silver bg-white px-3 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
              />
            </div>
          )}

          {/* Is Active */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </span>
              <span className="text-sm font-medium text-charcoal">Active</span>
            </label>
          </div>

          {/* Registration Open */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={registrationOpen}
                  onChange={(e) => setRegistrationOpen(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-silver rounded-full peer peer-checked:bg-lavender transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </span>
              <span className="text-sm font-medium text-charcoal">Registration open</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Season"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
