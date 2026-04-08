"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { SimpleSelect } from "@/components/ui/select";

interface Lead {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  pipeline_stage: string;
  intake_form_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  evaluation_scheduled_at: string | null;
  daysInStage: number;
}

interface HistoryRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  moved_by_name: string | null;
  note: string | null;
  created_at: string;
}

const STAGES: Array<{ key: string; label: string }> = [
  { key: "inquiry", label: "Inquiry" },
  { key: "trial_requested", label: "Trial Requested" },
  { key: "trial_scheduled", label: "Trial Scheduled" },
  { key: "trial_attended", label: "Trial Attended" },
  { key: "evaluation_requested", label: "Evaluation Requested" },
  { key: "evaluation_scheduled", label: "Evaluation Scheduled" },
  { key: "placement_recommended", label: "Placement Recommended" },
  { key: "contract_pending", label: "Contract Pending" },
  { key: "enrolled", label: "Enrolled" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

const SOURCE_COLORS: Record<string, string> = {
  website: "bg-blue-100 text-blue-700",
  referral: "bg-green-100 text-green-700",
  walk_in: "bg-purple-100 text-purple-700",
  email: "bg-amber-100 text-amber-700",
  social: "bg-pink-100 text-pink-700",
  other: "bg-gray-100 text-gray-700",
};

function urgencyBorder(days: number): string {
  if (days >= 7) return "border-l-4 border-l-red-500";
  if (days >= 3) return "border-l-4 border-l-amber-500";
  return "border-l-4 border-l-transparent";
}

function getChildName(lead: Lead): string {
  const data = lead.intake_form_data ?? {};
  const childName = (data as any).child_name || (data as any).student_name;
  if (childName) return String(childName);
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ");
}
function getChildAge(lead: Lead): string | null {
  const data = lead.intake_form_data ?? {};
  const age = (data as any).child_age || (data as any).age;
  return age ? String(age) : null;
}
function getGuardianName(lead: Lead): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ");
}
function getClassInterest(lead: Lead): string | null {
  const data = lead.intake_form_data ?? {};
  const interest = (data as any).class_of_interest || (data as any).interest;
  if (interest) return String(interest);
  return lead.notes;
}
function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ── Draggable Card ───────────────────────────────────────────
function LeadCard({
  lead,
  onClick,
  onAction,
}: {
  lead: Lead;
  onClick: () => void;
  onAction: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const childName = getChildName(lead);
  const age = getChildAge(lead);
  const guardian = getGuardianName(lead);
  const interest = getClassInterest(lead);
  const sourceCls = SOURCE_COLORS[lead.source ?? "other"] ?? SOURCE_COLORS.other;
  const urgent7 = lead.daysInStage >= 7;
  const urgent3 = lead.daysInStage >= 3 && lead.daysInStage < 7;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only trigger click if it wasn't a drag
        if (!isDragging) onClick();
      }}
      className={`bg-white rounded-lg p-3 space-y-2 transition-shadow hover:shadow-md cursor-pointer ${urgencyBorder(lead.daysInStage)} ${isDragging ? "opacity-30" : ""}`}
      style={{ boxShadow: "0 1px 3px rgba(107, 90, 153, 0.08)" }}
    >
      <div>
        <div className="text-sm font-semibold text-charcoal truncate">
          {childName}{age ? ` · age ${age}` : ""}
        </div>
        {guardian && guardian !== childName && (
          <div className="text-[11px] text-gray-500 truncate mt-0.5">{guardian}</div>
        )}
      </div>
      {interest && <div className="text-xs text-slate line-clamp-2">{interest}</div>}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sourceCls}`}>
          {lead.source ?? "other"}
        </span>
        <span className={`text-[11px] font-semibold ${urgent7 ? "text-red-600" : urgent3 ? "text-amber-600" : "text-mist"}`}>
          {lead.daysInStage} {lead.daysInStage === 1 ? "day" : "days"}
        </span>
      </div>
    </div>
  );
}

// ── Droppable Column ─────────────────────────────────────────
function StageColumn({
  stage,
  leads,
  onCardClick,
  onAction,
}: {
  stage: { key: string; label: string };
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  onAction: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div className="w-[280px] shrink-0 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between rounded-t-lg"
        style={{ backgroundColor: "#9C8BBF" }}
      >
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">{stage.label}</h2>
        <span
          className="text-[11px] font-semibold rounded-full min-w-[22px] h-[22px] inline-flex items-center justify-center px-2 bg-white"
          style={{ color: "#9C8BBF" }}
        >
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2.5 overflow-y-auto min-h-[500px] transition-colors ${isOver ? "bg-lavender/5" : ""}`}
      >
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-3xl opacity-40">&#x1FA70;</span>
            <span className="text-xs italic text-mist">No leads</span>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} onAction={onAction} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Lead Detail Drawer ───────────────────────────────────────
function LeadDetailDrawer({
  leadId,
  onClose,
  onStageChanged,
}: {
  leadId: string;
  onClose: () => void;
  onStageChanged: () => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [overrideStage, setOverrideStage] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  // Edit name state
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Action panels
  const [actionPanel, setActionPanel] = useState<"trial" | "delete" | null>(null);
  const [trialDate, setTrialDate] = useState("");
  const [trialClassId, setTrialClassId] = useState("");
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLead(data.lead);
        setHistory(data.history ?? []);
        setOverrideStage(data.lead?.pipeline_stage ?? "");
        setFirstName(data.lead?.first_name ?? "");
        setLastName(data.lead?.last_name ?? "");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [leadId]);

  async function refetchLead() {
    const detail = await fetch(`/api/admin/leads/${leadId}`).then((r) => r.json());
    setLead(detail.lead);
    setHistory(detail.history ?? []);
    setFirstName(detail.lead?.first_name ?? "");
    setLastName(detail.lead?.last_name ?? "");
  }

  async function loadClassesIfNeeded() {
    if (classOptions.length > 0) return;
    try {
      const res = await fetch(`/api/admin/classes`);
      if (res.ok) {
        const data = await res.json();
        const list = (data.classes ?? data ?? []) as Array<{ id: string; name: string }>;
        setClassOptions(list.map((c) => ({ value: c.id, label: c.name })));
      }
    } catch (e) {
      console.error("[lead-drawer] failed to load classes", e);
    }
  }

  async function saveName() {
    if (!lead) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to save");
        return;
      }
      setEditingName(false);
      await refetchLead();
      onStageChanged();
    } finally {
      setBusy(false);
    }
  }

  async function bookTrial() {
    if (!lead || !trialDate) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/schedule-trial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trial_date: trialDate, class_id: trialClassId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to book trial");
        return;
      }
      setActionPanel(null);
      setTrialDate("");
      setTrialClassId("");
      await refetchLead();
      onStageChanged();
    } finally {
      setBusy(false);
    }
  }

  async function createStudent() {
    if (!lead) return;
    if (!confirm("Create student record from this lead?")) return;
    setBusy(true);
    try {
      const dob = window.prompt("Student date of birth (YYYY-MM-DD):");
      if (!dob) { setBusy(false); return; }
      const res = await fetch(`/api/admin/leads/${lead.id}/convert-to-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_of_birth: dob }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to create student");
        return;
      }
      alert("Student created");
      await refetchLead();
      onStageChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteLead() {
    if (!lead || !deleteReason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "lost", note: `Reason: ${deleteReason}` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed");
        return;
      }
      // Also save reason to placement_notes
      await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placement_notes: `Removed: ${deleteReason}` }),
      });
      setActionPanel(null);
      setDeleteReason("");
      await refetchLead();
      onStageChanged();
    } finally {
      setBusy(false);
    }
  }

  async function moveStage() {
    if (!overrideStage || !lead) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: overrideStage, note: overrideNote || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to move stage");
        return;
      }
      setOverrideNote("");
      // Refetch
      const detail = await fetch(`/api/admin/leads/${lead.id}`).then((r) => r.json());
      setLead(detail.lead);
      setHistory(detail.history ?? []);
      onStageChanged();
    } finally {
      setBusy(false);
    }
  }

  const childName = lead ? getChildName(lead) : "";
  const age = lead ? getChildAge(lead) : null;
  const interest = lead ? getClassInterest(lead) : null;
  const guardian = lead ? getGuardianName(lead) : "";
  const intake = (lead?.intake_form_data ?? {}) as Record<string, unknown>;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white z-50 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-silver flex items-start justify-between">
          <div className="flex-1">
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="h-9 rounded-md border border-silver px-3 text-sm focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
                />
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="h-9 rounded-md border border-silver px-3 text-sm focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
                />
                <button
                  disabled={busy}
                  onClick={saveName}
                  className="h-9 rounded-md text-xs font-semibold text-white px-3 disabled:opacity-50"
                  style={{ backgroundColor: "#9C8BBF" }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditingName(false); setFirstName(lead?.first_name ?? ""); setLastName(lead?.last_name ?? ""); }}
                  className="h-9 rounded-md text-xs text-slate hover:bg-cloud px-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <h2
                onClick={() => !loading && setEditingName(true)}
                className="font-heading text-xl font-semibold text-charcoal cursor-pointer hover:text-lavender transition-colors"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
                title="Click to edit"
              >
                {loading ? "Loading…" : (childName || "Unknown")}
                {age && <span className="text-mist text-sm ml-2">age {age}</span>}
              </h2>
            )}
            {interest && !editingName && <p className="mt-1 text-sm text-slate">{interest}</p>}
          </div>
          <button onClick={onClose} className="text-mist hover:text-charcoal text-2xl leading-none ml-2">×</button>
        </div>

        {lead && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Quick action toolbar */}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => { setActionPanel(actionPanel === "trial" ? null : "trial"); loadClassesIfNeeded(); }}
                className="h-9 rounded-md text-xs font-semibold text-white px-3 disabled:opacity-50"
                style={{ backgroundColor: "#9C8BBF" }}
              >
                Book Trial
              </button>
              <button
                disabled={busy}
                onClick={createStudent}
                className="h-9 rounded-md text-xs font-semibold border border-lavender text-lavender bg-white hover:bg-lavender/5 px-3 disabled:opacity-50"
              >
                Create Student
              </button>
              <button
                disabled={busy}
                onClick={() => setActionPanel(actionPanel === "delete" ? null : "delete")}
                className="h-9 rounded-md text-xs font-semibold border border-red-300 text-red-600 bg-white hover:bg-red-50 px-3 disabled:opacity-50"
              >
                Delete Lead
              </button>
            </div>

            {actionPanel === "trial" && (
              <div className="rounded-lg border border-lavender/30 bg-lavender/5 p-3 space-y-2">
                <div className="text-xs text-mist uppercase tracking-wide">Book Trial</div>
                <input
                  type="date"
                  value={trialDate}
                  onChange={(e) => setTrialDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-silver bg-white px-3 text-sm focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
                />
                <SimpleSelect
                  value={trialClassId}
                  onValueChange={setTrialClassId}
                  options={classOptions}
                  placeholder="Select a class (optional)"
                  className="w-full"
                />
                <button
                  disabled={busy || !trialDate}
                  onClick={bookTrial}
                  className="h-9 w-full rounded-md text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#9C8BBF" }}
                >
                  Confirm Trial
                </button>
              </div>
            )}

            {actionPanel === "delete" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                <div className="text-xs text-red-700 font-semibold">Delete this lead?</div>
                <SimpleSelect
                  value={deleteReason}
                  onValueChange={setDeleteReason}
                  options={[
                    { value: "Duplicate", label: "Duplicate" },
                    { value: "Spam", label: "Spam" },
                    { value: "Wrong number", label: "Wrong number" },
                    { value: "Not interested", label: "Not interested" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select a reason"
                  className="w-full"
                />
                <button
                  disabled={busy || !deleteReason}
                  onClick={deleteLead}
                  className="h-9 w-full rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm — Mark as Lost
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-mist uppercase tracking-wide">Stage</div>
                <div className="mt-1">
                  <span className="inline-block text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: "#9C8BBF" }}>
                    {STAGE_LABEL[lead.pipeline_stage] ?? lead.pipeline_stage}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-mist uppercase tracking-wide">Days in stage</div>
                <div className="mt-1 text-sm font-semibold text-charcoal">
                  {lead.daysInStage} {lead.daysInStage === 1 ? "day" : "days"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-mist uppercase tracking-wide">Guardian</div>
              <div className="mt-1 text-sm text-charcoal">{guardian || "—"}</div>
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="text-xs text-lavender hover:underline block">
                  {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="text-xs text-lavender hover:underline block">
                  {lead.phone}
                </a>
              )}
            </div>

            <div>
              <div className="text-xs text-mist uppercase tracking-wide">Source</div>
              <div className="mt-1">
                <span className={`inline-block text-[11px] px-2 py-1 rounded-full font-medium ${SOURCE_COLORS[lead.source ?? "other"]}`}>
                  {lead.source ?? "other"}
                </span>
              </div>
            </div>

            {Boolean(intake.experience_level || intake.preferred_days || intake.disciplines) && (
              <div>
                <div className="text-xs text-mist uppercase tracking-wide mb-1">Intake</div>
                <div className="space-y-1 text-xs text-charcoal">
                  {intake.experience_level !== undefined && (
                    <div><span className="text-mist">Experience:</span> {String(intake.experience_level)}</div>
                  )}
                  {intake.preferred_days !== undefined && (
                    <div><span className="text-mist">Preferred days:</span> {Array.isArray(intake.preferred_days) ? (intake.preferred_days as unknown[]).join(", ") : String(intake.preferred_days)}</div>
                  )}
                  {intake.disciplines !== undefined && (
                    <div><span className="text-mist">Disciplines:</span> {Array.isArray(intake.disciplines) ? (intake.disciplines as unknown[]).join(", ") : String(intake.disciplines)}</div>
                  )}
                </div>
              </div>
            )}

            {lead.notes && (
              <div>
                <div className="text-xs text-mist uppercase tracking-wide">Notes</div>
                <div className="mt-1 text-sm text-charcoal whitespace-pre-wrap">{lead.notes}</div>
              </div>
            )}

            <div className="border-t border-silver pt-5">
              <div className="text-xs text-mist uppercase tracking-wide mb-2">Move to stage</div>
              <div className="mb-2">
                <SimpleSelect
                  value={overrideStage}
                  onValueChange={setOverrideStage}
                  options={[
                    ...STAGES.map((s) => ({ value: s.key, label: s.label })),
                    { value: "waitlisted", label: "Waitlisted" },
                    { value: "lost", label: "Lost" },
                  ]}
                  placeholder="Select stage"
                  className="w-full"
                />
              </div>
              <textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Optional note (visible in audit trail)"
                rows={2}
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal mb-2"
              />
              <button
                disabled={busy || overrideStage === lead.pipeline_stage}
                onClick={moveStage}
                className="h-9 w-full rounded-md text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#9C8BBF" }}
              >
                Move Stage
              </button>
            </div>

            <div className="border-t border-silver pt-5">
              <div className="text-xs text-mist uppercase tracking-wide mb-2">Stage History</div>
              {history.length === 0 ? (
                <div className="text-xs text-mist italic">No stage changes yet.</div>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="text-xs text-charcoal">
                      <div>
                        Moved to <strong>{STAGE_LABEL[h.to_stage] ?? h.to_stage}</strong>
                        {h.moved_by_name && <> by {h.moved_by_name}</>}
                      </div>
                      <div className="text-mist">
                        {formatDateTime(h.created_at)}
                        {h.from_stage && <> · from {STAGE_LABEL[h.from_stage] ?? h.from_stage}</>}
                      </div>
                      {h.note && <div className="text-slate italic mt-1">"{h.note}"</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Board ───────────────────────────────────────────────
export function PipelineBoard({
  leads: initialLeads,
  initialSource,
  initialUrgency,
}: {
  leads: Lead[];
  initialSource: string;
  initialUrgency: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [leads, setLeads] = useState(initialLeads);
  const [source, setSource] = useState(initialSource);
  const [urgency, setUrgency] = useState(initialUrgency);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);

  // Sync from server when initialLeads changes (e.g. after refresh)
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function applyFilters(nextSource: string, nextUrgency: string) {
    const params = new URLSearchParams();
    if (nextSource) params.set("source", nextSource);
    if (nextUrgency) params.set("urgency", nextUrgency);
    const qs = params.toString();
    router.push(`/admin/enrollment/pipeline${qs ? `?${qs}` : ""}`);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const leadId = String(e.active.id);
    const newStage = String(e.over.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.pipeline_stage === newStage) return;

    const previousStage = lead.pipeline_stage;
    // Optimistic update
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline_stage: newStage, daysInStage: 0 } : l)));

    try {
      const res = await fetch(`/api/admin/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        // Revert
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline_stage: previousStage } : l)));
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to move card");
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline_stage: previousStage } : l)));
    }
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-charcoal" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Enrollment Pipeline
          </h1>
          <p className="mt-1 text-sm text-mist">{leads.length} active leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); applyFilters(e.target.value, urgency); }}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-lavender/30"
          >
            <option value="">All Sources</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="walk_in">Walk-In</option>
            <option value="email">Email</option>
            <option value="social">Social</option>
            <option value="other">Other</option>
          </select>
          <select
            value={urgency}
            onChange={(e) => { setUrgency(e.target.value); applyFilters(source, e.target.value); }}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-lavender/30"
          >
            <option value="">All Urgency</option>
            <option value="3">Overdue 3+ days</option>
            <option value="7">Overdue 7+ days</option>
          </select>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-row items-stretch gap-4 overflow-x-auto pb-4 pipeline-scroll">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              leads={leads.filter((l) => l.pipeline_stage === stage.key)}
              onCardClick={(lead) => setDrawerLeadId(lead.id)}
              onAction={() => {}}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && (
            <div className="bg-white rounded-lg p-3 space-y-1 shadow-2xl border border-lavender/40 w-[256px]">
              <div className="text-sm font-semibold text-charcoal">{getChildName(activeLead)}</div>
              {getChildAge(activeLead) && (
                <div className="text-xs text-mist">age {getChildAge(activeLead)}</div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {drawerLeadId && (
        <LeadDetailDrawer
          leadId={drawerLeadId}
          onClose={() => setDrawerLeadId(null)}
          onStageChanged={() => {
            // Refresh server data
            startTransition(() => router.refresh());
          }}
        />
      )}

      <style jsx global>{`
        .pipeline-scroll::-webkit-scrollbar {
          height: 0px;
          background: transparent;
        }
        .pipeline-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
