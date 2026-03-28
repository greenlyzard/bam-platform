"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type {
  ClassRecord,
  ClassTeacher,
  TeacherOption,
  DisciplineOption,
  CurriculumOption,
  SeasonOption,
  ProductionOption,
  ClosureRecord,
  PricingRule,
  ClassPhase,
} from "./class-management";

const LEVEL_OPTIONS = [
  "Petites",
  "Level 1",
  "Level 2A",
  "Level 2B",
  "Level 2C",
  "Level 3A",
  "Level 3B",
  "Level 3C",
  "Level 4A",
  "Level 4B",
  "Level 4C",
  "Adult/Teen",
];

const DAY_LABELS = [
  { value: 0, label: "Su" },
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
];

const TEACHER_ROLES = [
  { value: "lead", label: "Lead" },
  { value: "assistant", label: "Assistant" },
  { value: "accompanist", label: "Accompanist" },
  { value: "observer", label: "Observer" },
];

const PHASE_TYPES = [
  { value: "technique", label: "Technique" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "performance", label: "Performance" },
];

interface TeacherRow {
  teacherId: string;
  role: string;
  isPrimary: boolean;
}

interface PricingRow {
  label: string;
  deadline: string;
  amount: string;
  discountType: string;
  discountValue: string;
  isBasePrice: boolean;
}

interface PhaseRow {
  phase: string;
  startDate: string;
  endDate: string;
  productionId: string;
  notes: string;
}

export function ClassEditDrawer({
  classData,
  isNew,
  teachers,
  disciplines,
  curriculum,
  seasons,
  productions,
  closures,
  classTeachers,
  pricingRules,
  classPhases,
  rooms,
  classColorPalette,
  tenantId,
  onClose,
  onSaved,
  onTeachersUpdated,
  onPricingUpdated,
  onPhasesUpdated,
}: {
  classData: ClassRecord | null;
  isNew: boolean;
  teachers: TeacherOption[];
  disciplines: DisciplineOption[];
  curriculum: CurriculumOption[];
  seasons: SeasonOption[];
  productions: ProductionOption[];
  closures: ClosureRecord[];
  classTeachers: ClassTeacher[];
  pricingRules: PricingRule[];
  classPhases: ClassPhase[];
  rooms: Array<{ id: string; name: string }>;
  classColorPalette: string[];
  tenantId: string;
  onClose: () => void;
  onSaved: (c: ClassRecord) => void;
  onTeachersUpdated: (classId: string, teachers: ClassTeacher[]) => void;
  onPricingUpdated: (classId: string, rules: PricingRule[]) => void;
  onPhasesUpdated: (classId: string, phases: ClassPhase[]) => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Section 1: Identity ──────────────────────────────
  const [name, setName] = useState(classData?.name ?? "");
  const [shortDesc, setShortDesc] = useState(
    classData?.short_description ?? ""
  );
  const [mediumDesc, setMediumDesc] = useState(
    classData?.medium_description ?? ""
  );
  const [longDesc, setLongDesc] = useState(classData?.long_description ?? "");
  const [gender, setGender] = useState(classData?.gender ?? "any");
  const [ageMin, setAgeMin] = useState(classData?.age_min?.toString() ?? "");
  const [ageMax, setAgeMax] = useState(classData?.age_max?.toString() ?? "");
  const [selectedLevels, setSelectedLevels] = useState<string[]>(
    classData?.levels ?? []
  );
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    classData?.discipline_ids ?? []
  );
  const [selectedCurriculum, setSelectedCurriculum] = useState<string[]>(
    classData?.curriculum_ids ?? []
  );

  // ── Section 2: Schedule ──────────────────────────────
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    classData?.days_of_week ??
      (classData?.day_of_week != null ? [classData.day_of_week] : [])
  );
  const [startTime, setStartTime] = useState(classData?.start_time ?? "");
  const [endTime, setEndTime] = useState(classData?.end_time ?? "");
  const [startDate, setStartDate] = useState(classData?.start_date ?? "");
  const [endDate, setEndDate] = useState(classData?.end_date ?? "");
  const [seasonId, setSeasonId] = useState(classData?.season_id ?? "");
  const [roomId, setRoomId] = useState(classData?.room_id ?? "");

  // ── Resources ───────────────────────────────────────
  const [allResources, setAllResources] = useState<{ id: string; name: string; type: string; is_active: boolean }[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  useEffect(() => {
    // Fetch active resources
    supabase
      .from("studio_resources")
      .select("id, name, type, is_active")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setAllResources(data ?? []));

    // Fetch current assignments if editing
    if (classData?.id) {
      supabase
        .from("studio_resource_assignments")
        .select("resource_id")
        .eq("class_id", classData.id)
        .then(({ data }) => setSelectedResourceIds((data ?? []).map((r) => r.resource_id)));
    }
  }, [classData?.id, supabase]);

  function toggleResource(id: string) {
    setSelectedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  // ── Section 3: Teachers ──────────────────────────────
  const [teacherRows, setTeacherRows] = useState<TeacherRow[]>(() => {
    if (classTeachers.length > 0) {
      return classTeachers.map((ct) => ({
        teacherId: ct.teacher_id,
        role: ct.role,
        isPrimary: ct.is_primary,
      }));
    }
    if (classData?.teacher_id) {
      return [
        { teacherId: classData.teacher_id, role: "lead", isPrimary: true },
      ];
    }
    return [{ teacherId: "", role: "lead", isPrimary: true }];
  });

  // ── Section 4: Enrollment & Visibility ───────────────
  const [maxEnrollment, setMaxEnrollment] = useState(
    (classData?.max_enrollment ?? classData?.max_students ?? 10).toString()
  );
  const [showCapacity, setShowCapacity] = useState(
    classData?.show_capacity_public ?? false
  );
  const [onlineReg, setOnlineReg] = useState(
    classData?.online_registration ?? true
  );
  const [isHidden, setIsHidden] = useState(classData?.is_hidden ?? false);

  // ── Section 5: Flags ─────────────────────────────────
  const [isNewFlag, setIsNewFlag] = useState(classData?.is_new ?? false);
  const [newExpiresAt, setNewExpiresAt] = useState(
    classData?.new_expires_at ?? ""
  );
  const [isRehearsal, setIsRehearsal] = useState(
    classData?.is_rehearsal ?? false
  );
  const [isPerformance, setIsPerformance] = useState(
    classData?.is_performance ?? false
  );
  const [colorHex, setColorHex] = useState<string | null>(
    (classData as any)?.color_hex ?? "#9C8BBF"
  );
  const [editingPalette, setEditingPalette] = useState(false);

  // ── Section 6: Phases ────────────────────────────────
  const [phaseRows, setPhaseRows] = useState<PhaseRow[]>(() =>
    classPhases.map((p) => ({
      phase: p.phase,
      startDate: p.start_date,
      endDate: p.end_date,
      productionId: p.production_id ?? "",
      notes: p.notes ?? "",
    }))
  );

  // ── Section 7: Pricing ───────────────────────────────
  const [pricingRows, setPricingRows] = useState<PricingRow[]>(() => {
    if (pricingRules.length > 0) {
      return pricingRules
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => ({
          label: r.label,
          deadline: r.deadline ?? "",
          amount: r.amount.toString(),
          discountType: r.discount_type ?? "flat",
          discountValue: r.discount_value?.toString() ?? "",
          isBasePrice: r.is_base_price,
        }));
    }
    return [
      {
        label: "Full Price",
        deadline: "",
        amount: classData?.fee_cents
          ? (classData.fee_cents / 100).toString()
          : "",
        discountType: "flat",
        discountValue: "",
        isBasePrice: true,
      },
    ];
  });

  // ── Closure warnings ─────────────────────────────────
  const closureWarnings =
    startDate && endDate
      ? closures.filter(
          (c) => c.closed_date >= startDate && c.closed_date <= endDate
        )
      : [];

  // ── Base price for savings calc ──────────────────────
  const basePrice = parseFloat(
    pricingRows.find((r) => r.isBasePrice)?.amount ?? "0"
  );

  // ── Teacher row helpers ──────────────────────────────
  function addTeacher() {
    setTeacherRows([
      ...teacherRows,
      { teacherId: "", role: "assistant", isPrimary: false },
    ]);
  }
  function removeTeacher(idx: number) {
    if (teacherRows[idx].isPrimary) return;
    setTeacherRows(teacherRows.filter((_, i) => i !== idx));
  }
  function updateTeacher(idx: number, field: keyof TeacherRow, value: string | boolean) {
    const next = [...teacherRows];
    if (field === "isPrimary" && value === true) {
      next.forEach((r, i) => (r.isPrimary = i === idx));
    } else {
      next[idx] = { ...next[idx], [field]: value };
    }
    setTeacherRows(next);
  }

  // ── Pricing row helpers ──────────────────────────────
  function addPricingRow() {
    setPricingRows([
      ...pricingRows,
      {
        label: "",
        deadline: "",
        amount: "",
        discountType: "flat",
        discountValue: "",
        isBasePrice: false,
      },
    ]);
  }
  function removePricingRow(idx: number) {
    if (pricingRows[idx].isBasePrice) return;
    setPricingRows(pricingRows.filter((_, i) => i !== idx));
  }
  function updatePricingRow(
    idx: number,
    field: keyof PricingRow,
    value: string | boolean
  ) {
    const next = [...pricingRows];
    next[idx] = { ...next[idx], [field]: value };
    setPricingRows(next);
  }

  // ── Phase row helpers ────────────────────────────────
  function addPhaseRow() {
    setPhaseRows([
      ...phaseRows,
      {
        phase: "technique",
        startDate: "",
        endDate: "",
        productionId: "",
        notes: "",
      },
    ]);
  }
  function removePhaseRow(idx: number) {
    setPhaseRows(phaseRows.filter((_, i) => i !== idx));
  }
  function updatePhaseRow(
    idx: number,
    field: keyof PhaseRow,
    value: string
  ) {
    const next = [...phaseRows];
    next[idx] = { ...next[idx], [field]: value };
    setPhaseRows(next);
  }

  // ── Level toggle ─────────────────────────────────────
  function toggleLevel(level: string) {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  // ── Day toggle ───────────────────────────────────────
  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // ── Save ─────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) {
      setError("Class name is required");
      return;
    }
    setSaving(true);
    setError(null);

    const classPayload = {
      name: name.trim(),
      short_description: shortDesc.trim() || null,
      medium_description: mediumDesc.trim() || null,
      long_description: longDesc.trim() || null,
      gender: gender || "any",
      age_min: ageMin ? parseInt(ageMin) : null,
      age_max: ageMax ? parseInt(ageMax) : null,
      levels: selectedLevels.length > 0 ? selectedLevels : null,
      discipline_ids:
        selectedDisciplines.length > 0 ? selectedDisciplines : null,
      curriculum_ids:
        selectedCurriculum.length > 0 ? selectedCurriculum : null,
      days_of_week: daysOfWeek.length > 0 ? daysOfWeek : null,
      day_of_week: daysOfWeek.length > 0 ? daysOfWeek[0] : null,
      start_time: startTime || null,
      end_time: endTime || null,
      start_date: startDate || null,
      end_date: endDate || null,
      season_id: seasonId || null,
      room_id: roomId || null,
      max_enrollment: maxEnrollment ? parseInt(maxEnrollment) : null,
      max_students: maxEnrollment ? parseInt(maxEnrollment) : 10,
      show_capacity_public: showCapacity,
      online_registration: onlineReg,
      is_hidden: isHidden,
      is_new: isNewFlag,
      new_expires_at: isNewFlag && newExpiresAt ? newExpiresAt : null,
      is_rehearsal: isRehearsal,
      is_performance: isPerformance,
      color_hex: colorHex || null,
      is_active: true,
      status: "active",
      teacher_id:
        teacherRows.length > 0 && teacherRows[0].teacherId
          ? teacherRows[0].teacherId
          : null,
    };

    let classId: string;

    if (isNew) {
      const { data, error: insertError } = await supabase
        .from("classes")
        .insert(classPayload)
        .select()
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Failed to create class");
        setSaving(false);
        return;
      }
      classId = data.id;
    } else {
      classId = classData!.id;
      const { error: updateError } = await supabase
        .from("classes")
        .update(classPayload)
        .eq("id", classId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    }

    // Save class_teachers: delete and reinsert
    await supabase.from("class_teachers").delete().eq("class_id", classId);
    const validTeachers = teacherRows.filter((t) => t.teacherId);
    if (validTeachers.length > 0) {
      const { data: newTeachers, error: tErr } = await supabase
        .from("class_teachers")
        .insert(
          validTeachers.map((t) => ({
            class_id: classId,
            teacher_id: t.teacherId,
            role: t.role,
            is_primary: t.isPrimary,
            tenant_id: tenantId,
          }))
        )
        .select();
      if (!tErr && newTeachers) {
        onTeachersUpdated(classId, newTeachers);
      }
    } else {
      onTeachersUpdated(classId, []);
    }

    // Save pricing rules: delete and reinsert
    await supabase
      .from("class_pricing_rules")
      .delete()
      .eq("class_id", classId);
    const validPricing = pricingRows.filter((r) => r.amount && r.label);
    if (validPricing.length > 0) {
      const { data: newRules, error: pErr } = await supabase
        .from("class_pricing_rules")
        .insert(
          validPricing.map((r, idx) => ({
            class_id: classId,
            tenant_id: tenantId,
            label: r.label,
            deadline: r.deadline || null,
            amount: parseFloat(r.amount),
            discount_type: r.isBasePrice ? null : r.discountType || null,
            discount_value:
              r.isBasePrice || !r.discountValue
                ? null
                : parseFloat(r.discountValue),
            is_base_price: r.isBasePrice,
            sort_order: idx,
          }))
        )
        .select();
      if (!pErr && newRules) {
        onPricingUpdated(classId, newRules);
      }
    } else {
      onPricingUpdated(classId, []);
    }

    // Save phases: delete and reinsert
    await supabase.from("class_phases").delete().eq("class_id", classId);
    const validPhases = phaseRows.filter((p) => p.startDate && p.endDate);
    if (validPhases.length > 0) {
      const { data: newPhases, error: phErr } = await supabase
        .from("class_phases")
        .insert(
          validPhases.map((p) => ({
            class_id: classId,
            tenant_id: tenantId,
            phase: p.phase,
            start_date: p.startDate,
            end_date: p.endDate,
            production_id: p.productionId || null,
            notes: p.notes || null,
          }))
        )
        .select();
      if (!phErr && newPhases) {
        onPhasesUpdated(classId, newPhases);
      }
    } else {
      onPhasesUpdated(classId, []);
    }

    // Save resource assignments: delete and reinsert
    await supabase
      .from("studio_resource_assignments")
      .delete()
      .eq("class_id", classId);
    if (selectedResourceIds.length > 0) {
      await supabase
        .from("studio_resource_assignments")
        .insert(
          selectedResourceIds.map((rid) => ({
            class_id: classId,
            resource_id: rid,
            tenant_id: tenantId,
          }))
        );
    }

    // Fetch the saved class back for state update
    const { data: saved } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (saved) {
      // Get enrollment count
      const { count } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .in("status", ["active", "trial"]);

      onSaved({
        ...saved,
        enrolledCount: count ?? 0,
        legacyTeacherName: null,
      });
    }

    setSaving(false);
  }

  // ── Attendance stats (Section 8) ─────────────────────
  const enrolledCount = classData?.enrolledCount ?? 0;
  const maxEnroll = classData?.max_enrollment ?? classData?.max_students ?? 10;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-silver px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-heading text-lg font-semibold text-charcoal">
            {isNew ? "New Class" : `Edit: ${classData?.name}`}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-lavender px-4 py-2 text-sm text-white hover:bg-lavender-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full text-slate hover:bg-cloud flex items-center justify-center"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="p-6 space-y-8">
          {/* ── SECTION 1: Identity ─────────────────────── */}
          <Section title="Identity">
            <Field label="Name *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </Field>
            <Field label="Short Description">
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="1-2 sentences"
                className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </Field>
            <Field label="Medium Description">
              <textarea
                value={mediumDesc}
                onChange={(e) => setMediumDesc(e.target.value)}
                rows={3}
                placeholder="One paragraph"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </Field>
            <Field label="Long Description">
              <textarea
                value={longDesc}
                onChange={(e) => setLongDesc(e.target.value)}
                rows={5}
                placeholder="Full description"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Gender">
                <SimpleSelect
                  value={gender}
                  onValueChange={(val) => setGender(val)}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                  ]}
                  placeholder="Select..."
                  className="w-full"
                />
              </Field>
              <Field label="Age Min">
                <input
                  type="number"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
              <Field label="Age Max">
                <input
                  type="number"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
            </div>

            {/* Levels multi-select */}
            <Field label="Levels">
              <div className="flex flex-wrap gap-1.5">
                {LEVEL_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selectedLevels.includes(level)
                        ? "bg-lavender text-white border-lavender"
                        : "bg-white text-slate border-silver hover:border-lavender"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </Field>

            {/* Disciplines multi-select */}
            <Field label="Disciplines">
              <div className="flex flex-wrap gap-1.5">
                {disciplines.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setSelectedDisciplines((prev) =>
                        prev.includes(d.id)
                          ? prev.filter((x) => x !== d.id)
                          : [...prev, d.id]
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selectedDisciplines.includes(d.id)
                        ? "bg-lavender text-white border-lavender"
                        : "bg-white text-slate border-silver hover:border-lavender"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </Field>

            {/* Curriculum multi-select */}
            <Field label="Curriculum">
              <div className="flex flex-wrap gap-1.5">
                {curriculum.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelectedCurriculum((prev) =>
                        prev.includes(c.id)
                          ? prev.filter((x) => x !== c.id)
                          : [...prev, c.id]
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selectedCurriculum.includes(c.id)
                        ? "bg-lavender text-white border-lavender"
                        : "bg-white text-slate border-silver hover:border-lavender"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* ── SECTION 2: Schedule ─────────────────────── */}
          <Section title="Schedule">
            <Field label="Days of Week">
              <div className="flex gap-1.5">
                {DAY_LABELS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`h-9 w-9 rounded-full text-xs font-medium border transition-colors ${
                      daysOfWeek.includes(d.value)
                        ? "bg-lavender text-white border-lavender"
                        : "bg-white text-slate border-silver hover:border-lavender"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
              <Field label="End Time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Season">
                <SimpleSelect
                  value={seasonId}
                  onValueChange={(val) => setSeasonId(val === "__none__" ? "" : val)}
                  options={[
                    { value: "__none__", label: "No season" },
                    ...seasons.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  placeholder="No season"
                  className="w-full"
                />
              </Field>
              <Field label="Room">
                <SimpleSelect
                  value={roomId}
                  onValueChange={(val) => setRoomId(val === "__none__" ? "" : val)}
                  options={[
                    { value: "__none__", label: "No room" },
                    ...rooms.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                  placeholder="No room"
                  className="w-full"
                />
              </Field>
            </div>
            {closureWarnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {closureWarnings.length} closure date
                {closureWarnings.length !== 1 ? "s" : ""} fall within this
                class range
                <ul className="mt-1 text-xs list-disc list-inside">
                  {closureWarnings.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      {c.closed_date}
                      {c.reason ? ` — ${c.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* ── Resources ────────────────────────────────── */}
          {allResources.length > 0 && (
            <Section title="Resources">
              <div className="space-y-1.5">
                {allResources.map((res) => (
                  <label
                    key={res.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cloud/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedResourceIds.includes(res.id)}
                      onChange={() => toggleResource(res.id)}
                      className="h-4 w-4 rounded border-silver text-lavender focus:ring-lavender/20"
                    />
                    <span className="text-sm text-charcoal">{res.name}</span>
                    <span className="text-xs text-mist capitalize">({res.type})</span>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* ── SECTION 3: Teachers ─────────────────────── */}
          <Section title="Teachers">
            <div className="space-y-2">
              {teacherRows.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-silver p-2"
                >
                  <SimpleSelect
                    value={row.teacherId}
                    onValueChange={(val) =>
                      updateTeacher(idx, "teacherId", val)
                    }
                    options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                    placeholder="Select teacher..."
                    className="flex-1"
                  />
                  <SimpleSelect
                    value={row.role}
                    onValueChange={(val) =>
                      updateTeacher(idx, "role", val)
                    }
                    options={TEACHER_ROLES}
                    placeholder="Select role..."
                    className="w-32"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate whitespace-nowrap cursor-pointer">
                    <input
                      type="radio"
                      name="primaryTeacher"
                      checked={row.isPrimary}
                      onChange={() => updateTeacher(idx, "isPrimary", true)}
                      className="h-3.5 w-3.5 text-lavender focus:ring-lavender/20"
                    />
                    Primary
                  </label>
                  {!row.isPrimary && teacherRows.length > 1 && (
                    <button
                      onClick={() => removeTeacher(idx)}
                      className="text-mist hover:text-red-500 text-sm"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTeacher}
              className="text-sm text-lavender hover:text-lavender-dark"
            >
              + Add Teacher
            </button>
          </Section>

          {/* ── SECTION 4: Enrollment & Visibility ──────── */}
          <Section title="Enrollment & Visibility">
            <Field label="Max Enrollment">
              <input
                type="number"
                value={maxEnrollment}
                onChange={(e) => setMaxEnrollment(e.target.value)}
                className="w-32 h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              />
            </Field>
            <Toggle
              label="Show capacity publicly"
              description={'"3 spots left" on website'}
              checked={showCapacity}
              onChange={setShowCapacity}
            />
            <Toggle
              label="Online registration enabled"
              checked={onlineReg}
              onChange={setOnlineReg}
            />
            <Toggle
              label="Hidden from live schedule"
              checked={isHidden}
              onChange={setIsHidden}
            />
          </Section>

          {/* ── SECTION 5: Flags ────────────────────────── */}
          <Section title="Flags">
            <Toggle
              label="New class"
              description="Shows NEW badge on listings"
              checked={isNewFlag}
              onChange={setIsNewFlag}
            />
            {isNewFlag && (
              <Field label="NEW expires at">
                <input
                  type="date"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-48 h-10 rounded-lg border border-silver px-3 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                />
              </Field>
            )}
            <Toggle
              label="Rehearsal"
              checked={isRehearsal}
              onChange={setIsRehearsal}
            />
            <Toggle
              label="Performance"
              checked={isPerformance}
              onChange={setIsPerformance}
            />
          </Section>

          {/* ── Calendar Color ──────────────────────────── */}
          <Section title="Calendar Color">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-mist uppercase tracking-wide">
                  Calendar Color
                </label>
                <button
                  type="button"
                  onClick={() => setEditingPalette(v => !v)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    editingPalette
                      ? "border-red-300 text-red-400 bg-red-50"
                      : "border-gray-200 text-mist hover:text-charcoal"
                  }`}
                >
                  {editingPalette ? "Done" : "Edit palette"}
                </button>
              </div>
              {/* Palette swatches */}
              <div className="flex flex-wrap gap-2">
                {classColorPalette.map(color => (
                  <div key={color} className="relative">
                    <button
                      type="button"
                      onClick={() => !editingPalette && setColorHex(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        colorHex === color && !editingPalette
                          ? "border-charcoal scale-110 shadow-md"
                          : "border-transparent hover:border-gray-300"
                      } ${editingPalette ? "opacity-70" : ""}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                    {editingPalette && (
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/admin/studio-settings/palette", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ color }),
                          });
                          if (colorHex === color) setColorHex(null);
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center hover:bg-red-600 shadow-sm"
                        title="Remove from palette"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {/* Custom color swatch if current color not in palette */}
                {colorHex && !classColorPalette.includes(colorHex) && !editingPalette && (
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full border-2 border-charcoal scale-110 shadow-md"
                    style={{ backgroundColor: colorHex }}
                    title={colorHex}
                  />
                )}
              </div>

              {/* Custom color input row */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorHex ?? "#9C8BBF"}
                  onChange={e => setColorHex(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
                <input
                  type="text"
                  value={colorHex ?? ""}
                  onChange={e => setColorHex(e.target.value)}
                  placeholder="#9C8BBF"
                  className="w-24 text-xs border border-gray-200 rounded px-2 py-1"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!colorHex || classColorPalette.includes(colorHex)) return;
                    await fetch("/api/admin/studio-settings/palette", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ color: colorHex }),
                    });
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    colorHex && !classColorPalette.includes(colorHex)
                      ? "border-lavender text-lavender hover:bg-lavender/10 cursor-pointer"
                      : "border-gray-200 text-gray-300 cursor-not-allowed"
                  }`}
                  disabled={!colorHex || classColorPalette.includes(colorHex)}
                >
                  + Add to palette
                </button>
                {colorHex && (
                  <button
                    type="button"
                    onClick={() => setColorHex(null)}
                    className="text-xs text-mist hover:text-red-400"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* ── SECTION 6: Class Phases ─────────────────── */}
          <Section title="Class Phases">
            {phaseRows.length > 0 && (
              <div className="space-y-2">
                {phaseRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-silver p-3 space-y-2"
                  >
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-mist">Phase</label>
                        <SimpleSelect
                          value={row.phase}
                          onValueChange={(val) =>
                            updatePhaseRow(idx, "phase", val)
                          }
                          options={PHASE_TYPES}
                          placeholder="Select phase..."
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-mist">Start</label>
                        <input
                          type="date"
                          value={row.startDate}
                          onChange={(e) =>
                            updatePhaseRow(idx, "startDate", e.target.value)
                          }
                          className="h-9 rounded-lg border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-mist">End</label>
                        <input
                          type="date"
                          value={row.endDate}
                          onChange={(e) =>
                            updatePhaseRow(idx, "endDate", e.target.value)
                          }
                          className="h-9 rounded-lg border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removePhaseRow(idx)}
                        className="h-9 text-mist hover:text-red-500 text-sm px-1"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-mist">Production</label>
                        <SimpleSelect
                          value={row.productionId}
                          onValueChange={(val) =>
                            updatePhaseRow(
                              idx,
                              "productionId",
                              val === "__none__" ? "" : val
                            )
                          }
                          options={[
                            { value: "__none__", label: "None" },
                            ...productions.map((p) => ({ value: p.id, label: p.name })),
                          ]}
                          placeholder="None"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-mist">Notes</label>
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) =>
                            updatePhaseRow(idx, "notes", e.target.value)
                          }
                          className="w-full h-9 rounded-lg border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={addPhaseRow}
              className="text-sm text-lavender hover:text-lavender-dark"
            >
              + Add Phase
            </button>
          </Section>

          {/* ── SECTION 7: Pricing ──────────────────────── */}
          <Section title="Pricing">
            <div className="space-y-2">
              {pricingRows.map((row, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-silver p-3 space-y-2"
                >
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-mist">
                        Label{row.isBasePrice ? " (Base)" : ""}
                      </label>
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) =>
                          updatePricingRow(idx, "label", e.target.value)
                        }
                        placeholder={row.isBasePrice ? "Full Price" : "Early Bird"}
                        className="w-full h-9 rounded-lg border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-xs text-mist">Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          updatePricingRow(idx, "amount", e.target.value)
                        }
                        className="w-full h-9 rounded-lg border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                      />
                    </div>
                    {!row.isBasePrice && (
                      <>
                        <div className="w-32">
                          <label className="text-xs text-mist">Deadline</label>
                          <input
                            type="date"
                            value={row.deadline}
                            onChange={(e) =>
                              updatePricingRow(
                                idx,
                                "deadline",
                                e.target.value
                              )
                            }
                            className="w-full h-9 rounded-lg border border-silver px-2 text-sm text-charcoal focus:border-lavender focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => removePricingRow(idx)}
                          className="h-9 text-mist hover:text-red-500 text-sm px-1"
                        >
                          &times;
                        </button>
                      </>
                    )}
                  </div>
                  {!row.isBasePrice && basePrice > 0 && row.amount && (
                    <p className="text-xs text-green-600">
                      Save $
                      {(basePrice - parseFloat(row.amount || "0")).toFixed(2)} vs
                      full price
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addPricingRow}
              className="text-sm text-lavender hover:text-lavender-dark"
            >
              + Add Early Bird Tier
            </button>
          </Section>

          {/* ── SECTION 8: Reporting (read-only) ────────── */}
          {!isNew && classData && (
            <Section title="Reporting">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-silver p-3 text-center">
                  <p className="text-lg font-heading font-semibold text-charcoal">
                    {enrolledCount}/{maxEnroll}
                  </p>
                  <p className="text-xs text-mist">Enrolled / Max</p>
                </div>
                <div className="rounded-lg border border-silver p-3 text-center">
                  <p className="text-lg font-heading font-semibold text-charcoal">
                    —
                  </p>
                  <p className="text-xs text-mist">Attendance Rate (30d)</p>
                </div>
              </div>
              <a
                href={`/admin/classes/${classData.id}/report`}
                className="text-sm text-lavender hover:text-lavender-dark"
              >
                View full class report &rarr;
              </a>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared UI helpers ────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-mist border-b border-silver pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <span className="text-sm font-medium text-charcoal">{label}</span>
        {description && (
          <p className="text-xs text-mist">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-lavender" : "bg-silver"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
