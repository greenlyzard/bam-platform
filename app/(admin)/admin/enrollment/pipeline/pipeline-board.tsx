"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

export function PipelineBoard({
  leads,
  initialSource,
  initialUrgency,
}: {
  leads: Lead[];
  initialSource: string;
  initialUrgency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [source, setSource] = useState(initialSource);
  const [urgency, setUrgency] = useState(initialUrgency);
  const [busyId, setBusyId] = useState<string | null>(null);

  function applyFilters(nextSource: string, nextUrgency: string) {
    const params = new URLSearchParams();
    if (nextSource) params.set("source", nextSource);
    if (nextUrgency) params.set("urgency", nextUrgency);
    const qs = params.toString();
    router.push(`/admin/enrollment/pipeline${qs ? `?${qs}` : ""}`);
  }

  async function moveStage(leadId: string, stage: string) {
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to update stage");
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusyId(null);
    }
  }

  async function scheduleTrial(leadId: string) {
    const dateInput = window.prompt("Trial date (YYYY-MM-DD):");
    if (!dateInput) return;
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/schedule-trial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trial_date: dateInput }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to schedule trial");
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusyId(null);
    }
  }

  async function markTrial(leadId: string, outcome: "attended" | "no_show") {
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/mark-trial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to update trial");
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusyId(null);
    }
  }

  function renderQuickAction(lead: Lead) {
    const disabled = busyId === lead.id || isPending;
    const btn = "h-7 rounded text-[11px] font-medium px-2 transition-colors disabled:opacity-50";
    const primary = `${btn} bg-lavender text-white hover:bg-lavender-dark`;
    const ghost = `${btn} border border-silver text-slate hover:bg-cloud`;

    switch (lead.pipeline_stage) {
      case "inquiry":
        return (
          <button disabled={disabled} onClick={() => moveStage(lead.id, "trial_requested")} className={primary}>
            Follow Up
          </button>
        );
      case "trial_requested":
        return (
          <button disabled={disabled} onClick={() => scheduleTrial(lead.id)} className={primary}>
            Schedule Trial
          </button>
        );
      case "trial_scheduled":
        return (
          <div className="flex gap-1">
            <button disabled={disabled} onClick={() => markTrial(lead.id, "attended")} className={primary}>
              Mark Attended
            </button>
            <button disabled={disabled} onClick={() => markTrial(lead.id, "no_show")} className={ghost}>
              No Show
            </button>
          </div>
        );
      case "trial_attended":
        return (
          <div className="flex gap-1">
            <button disabled={disabled} onClick={() => moveStage(lead.id, "placement_recommended")} className={primary}>
              Recommend Classes
            </button>
            <button disabled={disabled} onClick={() => moveStage(lead.id, "evaluation_requested")} className={ghost}>
              Request Eval
            </button>
          </div>
        );
      case "evaluation_requested":
        return (
          <button disabled={disabled} onClick={() => moveStage(lead.id, "evaluation_scheduled")} className={primary}>
            Schedule Evaluation
          </button>
        );
      case "evaluation_scheduled":
        return (
          <button disabled={disabled} onClick={() => moveStage(lead.id, "placement_recommended")} className={primary}>
            Complete Evaluation
          </button>
        );
      case "placement_recommended":
        return (
          <button disabled={disabled} onClick={() => moveStage(lead.id, "contract_pending")} className={primary}>
            View Cart
          </button>
        );
      case "contract_pending":
        return (
          <button disabled={disabled} onClick={() => moveStage(lead.id, "enrolled")} className={primary}>
            Send Reminder
          </button>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">Enrollment Pipeline</h1>
          <p className="mt-1 text-sm text-slate">{leads.length} active leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); applyFilters(e.target.value, urgency); }}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal"
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
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal"
          >
            <option value="">All Urgency</option>
            <option value="3">Overdue 3+ days</option>
            <option value="7">Overdue 7+ days</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-3 pb-4" style={{ minWidth: STAGES.length * 280 }}>
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.pipeline_stage === stage.key);
            return (
              <div key={stage.key} className="w-[270px] shrink-0 bg-cloud/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold text-charcoal uppercase tracking-wide">{stage.label}</h2>
                  <span className="text-xs text-mist">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.length === 0 ? (
                    <div className="text-xs text-mist text-center py-4">No leads</div>
                  ) : (
                    stageLeads.map((lead) => {
                      const childName = getChildName(lead);
                      const age = getChildAge(lead);
                      const guardian = getGuardianName(lead);
                      const interest = getClassInterest(lead);
                      const sourceCls = SOURCE_COLORS[lead.source ?? "other"] ?? SOURCE_COLORS.other;
                      return (
                        <div
                          key={lead.id}
                          className={`bg-white rounded-lg p-3 shadow-sm space-y-2 ${urgencyBorder(lead.daysInStage)}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-charcoal truncate">
                                {childName}{age ? ` (age ${age})` : ""}
                              </div>
                              {guardian && guardian !== childName && (
                                <div className="text-xs text-mist truncate">Guardian: {guardian}</div>
                              )}
                            </div>
                          </div>
                          {interest && (
                            <div className="text-xs text-slate line-clamp-2">{interest}</div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sourceCls}`}>
                              {lead.source ?? "other"}
                            </span>
                            <span className={`text-[10px] ${lead.daysInStage >= 7 ? "text-red-600 font-semibold" : lead.daysInStage >= 3 ? "text-amber-600 font-semibold" : "text-mist"}`}>
                              {lead.daysInStage}d
                            </span>
                          </div>
                          <div className="pt-1">{renderQuickAction(lead)}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
