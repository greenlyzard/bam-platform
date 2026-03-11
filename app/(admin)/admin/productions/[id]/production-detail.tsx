"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProduction,
  updateApprovalStatus,
  addDanceToProduction,
  removeDanceFromProduction,
  createDance,
  assignCasting,
  removeCasting,
  createRehearsal,
  updateRehearsalApproval,
  deleteRehearsal,
} from "../actions";
import { ProductionForm } from "../production-form";

// ── Types ────────────────────────────────────────────────

interface Production {
  id: string;
  name: string;
  production_type: string;
  season: string | null;
  performance_date: string | null;
  approval_status: string;
  is_published: boolean;
  [key: string]: unknown;
}

interface ProdDance {
  id: string;
  dance_id: string;
  performance_order: number;
  performance_type: string;
  danceTitle: string;
  discipline: string;
  level: string | null;
  choreographerName: string | null;
  music_title: string | null;
  costume_description: string | null;
}

interface CastEntry {
  id: string;
  production_dance_id: string;
  student_id: string;
  role: string;
  is_alternate: boolean;
  studentFirstName: string;
  studentLastName: string;
  studentLevel: string | null;
}

interface Rehearsal {
  id: string;
  production_dance_id: string;
  rehearsal_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  rehearsal_type: string;
  approval_status: string;
  is_mandatory: boolean;
  notes: string | null;
  danceTitle: string | null;
  approvedByName: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  current_level: string | null;
}

interface Dance {
  id: string;
  title: string;
  discipline: string;
  level: string | null;
  choreographerName: string | null;
}

// ── Helpers ──────────────────────────────────────────────

const TABS = ["Overview", "Dances", "Casting", "Rehearsals"] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-cloud text-mist",
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  published: "bg-lavender/10 text-lavender-dark",
};

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  soloist: "Soloist",
  corps: "Corps",
  ensemble: "Ensemble",
};

const REHEARSAL_TYPE_LABELS: Record<string, string> = {
  rehearsal: "Rehearsal",
  dress_rehearsal: "Dress Rehearsal",
  tech_rehearsal: "Tech Rehearsal",
  spacing: "Spacing",
};

const DISCIPLINE_LABELS: Record<string, string> = {
  ballet: "Ballet",
  jazz: "Jazz",
  contemporary: "Contemporary",
  hip_hop: "Hip Hop",
  lyrical: "Lyrical",
  tap: "Tap",
  musical_theatre: "Musical Theatre",
  pointe: "Pointe",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Main Component ───────────────────────────────────────

export function ProductionDetail({
  production,
  prodDances,
  casting,
  rehearsals,
  students,
  allDances,
}: {
  production: Production;
  prodDances: ProdDance[];
  casting: CastEntry[];
  rehearsals: Rehearsal[];
  students: Student[];
  allDances: Dance[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div className="space-y-6">
      {/* Status + Approval Bar */}
      <ApprovalBar production={production} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-silver">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-lavender text-lavender-dark"
                : "border-transparent text-slate hover:text-charcoal"
            }`}
          >
            {t}
            {t === "Dances" && ` (${prodDances.length})`}
            {t === "Casting" && ` (${casting.length})`}
            {t === "Rehearsals" && ` (${rehearsals.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "Overview" && <OverviewTab production={production} />}
      {tab === "Dances" && (
        <DancesTab
          productionId={production.id}
          prodDances={prodDances}
          allDances={allDances}
        />
      )}
      {tab === "Casting" && (
        <CastingTab
          productionId={production.id}
          prodDances={prodDances}
          casting={casting}
          students={students}
        />
      )}
      {tab === "Rehearsals" && (
        <RehearsalsTab
          productionId={production.id}
          prodDances={prodDances}
          rehearsals={rehearsals}
        />
      )}
    </div>
  );
}

// ── Approval Bar ─────────────────────────────────────────

function ApprovalBar({ production }: { production: Production }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function changeStatus(status: "draft" | "pending_review" | "approved" | "published") {
    setLoading(true);
    const result = await updateApprovalStatus(production.id, status);
    if (result.error) alert(result.error);
    else router.refresh();
    setLoading(false);
  }

  const s = production.approval_status;

  return (
    <div className="rounded-xl border border-silver bg-white p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate">Status:</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLES[s]}`}>
          {s === "pending_review" ? "Pending Review" : s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {s === "draft" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => changeStatus("pending_review")}
            className="h-8 rounded-lg bg-warning/10 text-warning text-xs font-semibold px-4 hover:bg-warning/20 transition-colors disabled:opacity-50"
          >
            Submit for Review
          </button>
        )}
        {s === "pending_review" && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => changeStatus("draft")}
              className="h-8 rounded-lg border border-silver text-xs font-medium px-4 hover:bg-cloud transition-colors text-slate disabled:opacity-50"
            >
              Back to Draft
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => changeStatus("approved")}
              className="h-8 rounded-lg bg-success/10 text-success text-xs font-semibold px-4 hover:bg-success/20 transition-colors disabled:opacity-50"
            >
              Approve
            </button>
          </>
        )}
        {s === "approved" && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => changeStatus("draft")}
              className="h-8 rounded-lg border border-silver text-xs font-medium px-4 hover:bg-cloud transition-colors text-slate disabled:opacity-50"
            >
              Revert to Draft
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => changeStatus("published")}
              className="h-8 rounded-lg bg-lavender text-white text-xs font-semibold px-4 hover:bg-lavender-dark transition-colors disabled:opacity-50"
            >
              Publish to Families
            </button>
          </>
        )}
        {s === "published" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => changeStatus("approved")}
            className="h-8 rounded-lg border border-silver text-xs font-medium px-4 hover:bg-cloud transition-colors text-slate disabled:opacity-50"
          >
            Unpublish
          </button>
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────

function OverviewTab({ production }: { production: Production }) {
  return <ProductionForm production={production as any} />;
}

// ── Dances Tab ───────────────────────────────────────────

function DancesTab({
  productionId,
  prodDances,
  allDances,
}: {
  productionId: string;
  prodDances: ProdDance[];
  allDances: Dance[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Filter out dances already in this production
  const existingDanceIds = new Set(prodDances.map((pd) => pd.dance_id));
  const available = allDances.filter((d) => !existingDanceIds.has(d.id));

  async function handleAddDance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await addDanceToProduction(productionId, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setShowAdd(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleCreateDance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await createDance(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setShowCreate(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRemove(pdId: string) {
    if (!confirm("Remove this dance from the production? Casting and rehearsals for it will also be deleted.")) return;
    const result = await removeDanceFromProduction(productionId, pdId);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate">
          Dances in this production, in performance order.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowCreate(true); setShowAdd(false); }}
            className="h-8 rounded-lg border border-silver text-xs font-medium px-3 hover:bg-cloud transition-colors text-slate"
          >
            New Dance
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(true); setShowCreate(false); }}
            className="h-8 rounded-lg bg-lavender text-white text-xs font-semibold px-3 hover:bg-lavender-dark transition-colors"
          >
            Add Existing Dance
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create new dance form */}
      {showCreate && (
        <form onSubmit={handleCreateDance} className="rounded-xl border border-lavender/30 bg-lavender/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-charcoal">Create New Dance</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input name="title" type="text" required placeholder="Dance title" className="h-9 rounded-lg border border-silver px-3 text-sm" />
            <select name="discipline" required className="h-9 rounded-lg border border-silver px-3 text-sm bg-white">
              {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input name="level" type="text" placeholder="Level (e.g. 3B)" className="h-9 rounded-lg border border-silver px-3 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="h-8 rounded-lg border border-silver text-xs px-3 text-slate">Cancel</button>
            <button type="submit" disabled={saving} className="h-8 rounded-lg bg-lavender text-white text-xs font-semibold px-4 disabled:opacity-50">
              {saving ? "..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* Add existing dance form */}
      {showAdd && (
        <form onSubmit={handleAddDance} className="rounded-xl border border-lavender/30 bg-lavender/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-charcoal">Add Dance to Production</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <select name="dance_id" required className="h-9 rounded-lg border border-silver px-3 text-sm bg-white">
              <option value="">Select a dance...</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} — {DISCIPLINE_LABELS[d.discipline] ?? d.discipline}
                  {d.level ? ` (${d.level})` : ""}
                </option>
              ))}
            </select>
            <select name="performance_type" required className="h-9 rounded-lg border border-silver px-3 text-sm bg-white">
              <option value="recital">Recital</option>
              <option value="competition">Competition</option>
              <option value="showcase">Showcase</option>
            </select>
            <input name="performance_order" type="number" defaultValue={prodDances.length + 1} min={0} placeholder="Order" className="h-9 rounded-lg border border-silver px-3 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="music_title" type="text" placeholder="Music title" className="h-9 rounded-lg border border-silver px-3 text-sm" />
            <input name="music_artist" type="text" placeholder="Music artist" className="h-9 rounded-lg border border-silver px-3 text-sm" />
            <input name="costume_description" type="text" placeholder="Costume description" className="h-9 rounded-lg border border-silver px-3 text-sm" />
            <input name="costume_notes" type="text" placeholder="Costume notes (hair, makeup, accessories)" className="h-9 rounded-lg border border-silver px-3 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="h-8 rounded-lg border border-silver text-xs px-3 text-slate">Cancel</button>
            <button type="submit" disabled={saving} className="h-8 rounded-lg bg-lavender text-white text-xs font-semibold px-4 disabled:opacity-50">
              {saving ? "..." : "Add Dance"}
            </button>
          </div>
        </form>
      )}

      {/* Dance list */}
      {prodDances.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white p-8 text-center">
          <p className="text-sm text-slate">No dances added yet. Create a new dance or add an existing one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prodDances.map((pd) => (
            <div key={pd.id} className="rounded-xl border border-silver bg-white p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-mist w-6">#{pd.performance_order}</span>
                  <span className="text-sm font-semibold text-charcoal">{pd.danceTitle}</span>
                  <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full">
                    {DISCIPLINE_LABELS[pd.discipline] ?? pd.discipline}
                  </span>
                  <span className="text-xs bg-cloud text-slate px-2 py-0.5 rounded-full">
                    {pd.performance_type}
                  </span>
                </div>
                <p className="text-xs text-slate pl-8">
                  {pd.level && `${pd.level} · `}
                  {pd.choreographerName && `Choreographer: ${pd.choreographerName} · `}
                  {pd.music_title && `Music: ${pd.music_title}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(pd.id)}
                className="h-7 rounded border border-silver text-xs px-2 hover:bg-red-50 hover:text-red-600 transition-colors text-mist shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Casting Tab ──────────────────────────────────────────

function CastingTab({
  productionId,
  prodDances,
  casting,
  students,
}: {
  productionId: string;
  prodDances: ProdDance[];
  casting: CastEntry[];
  students: Student[];
}) {
  const router = useRouter();
  const [selectedPd, setSelectedPd] = useState<string>(prodDances[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [castRole, setCastRole] = useState("ensemble");
  const [saving, setSaving] = useState(false);

  const filteredCast = casting.filter((c) => c.production_dance_id === selectedPd);
  const castStudentIds = new Set(filteredCast.map((c) => c.student_id));

  const searchResults = search.length >= 2
    ? students
        .filter(
          (s) =>
            !castStudentIds.has(s.id) &&
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 8)
    : [];

  async function handleAssign(studentId: string) {
    setSaving(true);
    const result = await assignCasting(productionId, selectedPd, studentId, castRole);
    if (result.error) alert(result.error);
    else {
      setSearch("");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRemove(castingId: string) {
    const result = await removeCasting(productionId, castingId);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  if (prodDances.length === 0) {
    return (
      <div className="rounded-xl border border-silver bg-white p-8 text-center">
        <p className="text-sm text-slate">Add dances to this production before assigning cast.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dance selector */}
      <div className="flex flex-wrap gap-2">
        {prodDances.map((pd) => (
          <button
            key={pd.id}
            type="button"
            onClick={() => setSelectedPd(pd.id)}
            className={`h-8 rounded-full px-3 text-xs font-medium border transition-colors ${
              selectedPd === pd.id
                ? "bg-lavender text-white border-lavender"
                : "bg-white text-slate border-silver hover:border-lavender"
            }`}
          >
            {pd.danceTitle}
            <span className="ml-1 opacity-70">
              ({casting.filter((c) => c.production_dance_id === pd.id).length})
            </span>
          </button>
        ))}
      </div>

      {/* Search and assign */}
      <div className="rounded-xl border border-silver bg-white p-4 space-y-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Search Students
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a student name..."
              className="w-full h-9 rounded-lg border border-silver px-3 text-sm focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">Role</label>
            <select
              value={castRole}
              onChange={(e) => setCastRole(e.target.value)}
              className="h-9 rounded-lg border border-silver px-3 text-sm bg-white"
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border border-silver rounded-lg divide-y divide-silver">
            {searchResults.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="text-sm text-charcoal">
                    {s.first_name} {s.last_name}
                  </span>
                  {s.current_level && (
                    <span className="text-xs text-mist ml-2">{s.current_level}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAssign(s.id)}
                  className="h-7 rounded bg-lavender/10 text-lavender-dark text-xs font-medium px-3 hover:bg-lavender/20 transition-colors disabled:opacity-50"
                >
                  Cast
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current cast list */}
      {filteredCast.length === 0 ? (
        <p className="text-sm text-slate text-center py-4">No cast assigned to this dance yet.</p>
      ) : (
        <div className="space-y-1">
          {filteredCast.map((c) => (
            <div key={c.id} className="rounded-lg border border-silver bg-white px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-charcoal">
                  {c.studentFirstName} {c.studentLastName}
                </span>
                <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full">
                  {ROLE_LABELS[c.role] ?? c.role}
                </span>
                {c.is_alternate && (
                  <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">
                    Alternate
                  </span>
                )}
                {c.studentLevel && (
                  <span className="text-xs text-mist">{c.studentLevel}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                className="text-xs text-mist hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rehearsals Tab ───────────────────────────────────────

function RehearsalsTab({
  productionId,
  prodDances,
  rehearsals,
}: {
  productionId: string;
  prodDances: ProdDance[];
  rehearsals: Rehearsal[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await createRehearsal(productionId, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setShowAdd(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleApprove(rehearsalId: string) {
    const result = await updateRehearsalApproval(productionId, rehearsalId, "approved");
    if (result.error) alert(result.error);
    else router.refresh();
  }

  async function handleDelete(rehearsalId: string) {
    if (!confirm("Delete this rehearsal?")) return;
    const result = await deleteRehearsal(productionId, rehearsalId);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate">
          Schedule rehearsals for each dance. Rehearsals require approval before families can see them.
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={prodDances.length === 0}
          className="h-8 rounded-lg bg-lavender text-white text-xs font-semibold px-3 hover:bg-lavender-dark transition-colors disabled:opacity-50"
        >
          Add Rehearsal
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border border-lavender/30 bg-lavender/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-charcoal">New Rehearsal</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="production_dance_id" required className="h-9 rounded-lg border border-silver px-3 text-sm bg-white">
              <option value="">Select dance...</option>
              {prodDances.map((pd) => (
                <option key={pd.id} value={pd.id}>{pd.danceTitle}</option>
              ))}
            </select>
            <select name="rehearsal_type" className="h-9 rounded-lg border border-silver px-3 text-sm bg-white">
              {Object.entries(REHEARSAL_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input name="rehearsal_date" type="date" required className="h-9 rounded-lg border border-silver px-3 text-sm" />
            <div className="flex gap-2">
              <input name="start_time" type="time" required placeholder="Start" className="h-9 flex-1 rounded-lg border border-silver px-3 text-sm" />
              <input name="end_time" type="time" required placeholder="End" className="h-9 flex-1 rounded-lg border border-silver px-3 text-sm" />
            </div>
            <input name="location" type="text" placeholder="Location (e.g. Studio A)" className="h-9 rounded-lg border border-silver px-3 text-sm" />
            <input name="location_address" type="text" placeholder="Address (if offsite)" className="h-9 rounded-lg border border-silver px-3 text-sm" />
          </div>
          <input name="notes" type="text" placeholder="Notes" className="w-full h-9 rounded-lg border border-silver px-3 text-sm" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="h-8 rounded-lg border border-silver text-xs px-3 text-slate">Cancel</button>
            <button type="submit" disabled={saving} className="h-8 rounded-lg bg-lavender text-white text-xs font-semibold px-4 disabled:opacity-50">
              {saving ? "..." : "Add Rehearsal"}
            </button>
          </div>
        </form>
      )}

      {rehearsals.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white p-8 text-center">
          <p className="text-sm text-slate">No rehearsals scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rehearsals.map((r) => (
            <div key={r.id} className="rounded-xl border border-silver bg-white p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-charcoal">
                    {formatDate(r.rehearsal_date)}
                  </span>
                  <span className="text-sm text-slate">
                    {formatTime(r.start_time)}–{formatTime(r.end_time)}
                  </span>
                  {r.danceTitle && (
                    <span className="text-xs bg-lavender/10 text-lavender-dark px-2 py-0.5 rounded-full">
                      {r.danceTitle}
                    </span>
                  )}
                  <span className="text-xs bg-cloud text-slate px-2 py-0.5 rounded-full">
                    {REHEARSAL_TYPE_LABELS[r.rehearsal_type] ?? r.rehearsal_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.approval_status]}`}>
                    {r.approval_status === "pending_review" ? "Pending" : r.approval_status.charAt(0).toUpperCase() + r.approval_status.slice(1)}
                  </span>
                  {r.is_mandatory && (
                    <span className="text-xs text-warning">Mandatory</span>
                  )}
                </div>
                <p className="text-xs text-slate">
                  {r.location && `${r.location} · `}
                  {r.notes && r.notes}
                  {r.approvedByName && ` · Approved by ${r.approvedByName}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.approval_status === "draft" && (
                  <button
                    type="button"
                    onClick={() => handleApprove(r.id)}
                    className="h-7 rounded text-xs font-medium px-2 bg-success/10 text-success hover:bg-success/20 transition-colors"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="h-7 rounded border border-silver text-xs px-2 hover:bg-red-50 hover:text-red-600 transition-colors text-mist"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
