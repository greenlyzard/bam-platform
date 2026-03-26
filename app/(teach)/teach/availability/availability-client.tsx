"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SimpleSelect } from "@/components/ui/select";
import { createAvailabilitySlot, updateAvailabilitySlot, deleteAvailabilitySlot, toggleSlotPublished, toggleAutoConfirm } from "./actions";

interface Slot {
  id: string; tenant_id: string; teacher_id: string; day_of_week: number | null;
  specific_date: string | null; start_time: string; end_time: string;
  is_recurring: boolean; slot_type: string; max_students: number;
  is_published: boolean; is_booked: boolean; created_at: string;
}
interface Props { slots: Slot[]; autoConfirmDefault: boolean; }

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat
const TYPE_BADGE: Record<string, string> = {
  private: "bg-lavender/10 text-dark-lavender", pilates: "bg-success/10 text-success", any: "bg-cloud text-slate",
};
const SLOT_TYPES = [{ value: "private", label: "Private" }, { value: "pilates", label: "Pilates" }, { value: "any", label: "Any" }];
const MAX_OPTS = [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }];
const INPUT_CLS = "w-full appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20";

function fmt(t: string) {
  if (!t) return "";
  const [hh, mm] = t.split(":"); const h = parseInt(hh, 10);
  const s = h >= 12 ? "PM" : "AM", d = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mm === "00" ? `${d} ${s}` : `${d}:${mm} ${s}`;
}
function fd(obj: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.append(k, v); return f; }

function Toggle({ on, onChange, color = "bg-success" }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${on ? color : "bg-gray-300"}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function SlotCard({ slot, onEdit, onDelete, onToggle }: { slot: Slot; onEdit: (s: Slot) => void; onDelete: (s: Slot) => void; onToggle: (s: Slot) => void }) {
  const badge = TYPE_BADGE[slot.slot_type] || "bg-cloud text-slate";
  return (
    <div className="rounded-lg border border-silver/60 bg-white p-3 hover:shadow-sm transition-shadow text-sm">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-medium text-charcoal">{fmt(slot.start_time)} &ndash; {fmt(slot.end_time)}</span>
        {slot.is_recurring && <span className="text-[10px] text-gray-400 uppercase tracking-wide">recurring</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badge}`}>{slot.slot_type}</span>
        {slot.max_students > 1 && <span className="text-xs text-gray-500">Up to {slot.max_students}</span>}
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${slot.is_published ? "bg-success/10 text-success" : "bg-cloud text-slate"}`}>
          {slot.is_published ? "Published" : "Draft"}
        </span>
        {slot.is_booked && <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gold/10 text-gold-dark">Booked</span>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onToggle(slot)} className="text-xs text-lavender hover:text-dark-lavender transition-colors">{slot.is_published ? "Unpublish" : "Publish"}</button>
        <button type="button" onClick={() => onEdit(slot)} className="text-xs text-charcoal hover:text-dark-lavender transition-colors">Edit</button>
        <button type="button" onClick={() => onDelete(slot)} disabled={slot.is_booked} className="text-xs text-error hover:text-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Delete</button>
      </div>
    </div>
  );
}

export function AvailabilityClient({ slots: initialSlots, autoConfirmDefault }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [autoConfirm, setAutoConfirm] = useState(autoConfirmDefault);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [formType, setFormType] = useState("private");
  const [formRecurring, setFormRecurring] = useState(true);
  const [formDays, setFormDays] = useState<number[]>([]);
  const [formDate, setFormDate] = useState("");
  const [formStart, setFormStart] = useState("15:00");
  const [formEnd, setFormEnd] = useState("16:00");
  const [formMax, setFormMax] = useState("1");
  const [formPublished, setFormPublished] = useState(false);

  const show = (message: string, type: "success" | "error" = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  function openAdd() {
    setEditingSlot(null); setFormType("private"); setFormRecurring(true); setFormDays([]);
    setFormDate(""); setFormStart("15:00"); setFormEnd("16:00"); setFormMax("1"); setFormPublished(false); setDrawerOpen(true);
  }
  function openEdit(s: Slot) {
    setEditingSlot(s); setFormType(s.slot_type); setFormRecurring(s.is_recurring);
    setFormDays(s.day_of_week != null ? [s.day_of_week] : []); setFormDate(s.specific_date || "");
    setFormStart(s.start_time?.slice(0, 5) || "15:00"); setFormEnd(s.end_time?.slice(0, 5) || "16:00");
    setFormMax(String(s.max_students)); setFormPublished(s.is_published); setDrawerOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      if (editingSlot) {
        const res = await updateAvailabilitySlot(fd({ id: editingSlot.id, is_recurring: String(formRecurring), day_of_week: formDays[0] != null ? String(formDays[0]) : "", specific_date: formDate, start_time: formStart, end_time: formEnd, slot_type: formType, max_students: formMax, is_published: String(formPublished) }));
        if (res.error) { show(res.error, "error"); return; }
        show("Slot updated.");
      } else {
        const days = formRecurring ? formDays : [0];
        if (formRecurring && days.length === 0) { show("Select at least one day.", "error"); return; }
        for (const day of days) {
          const res = await createAvailabilitySlot(fd({ is_recurring: String(formRecurring), day_of_week: String(day), specific_date: formDate, start_time: formStart, end_time: formEnd, slot_type: formType, max_students: formMax, is_published: String(formPublished) }));
          if (res.error) { show(res.error, "error"); return; }
        }
        show(days.length > 1 ? `${days.length} slots created.` : "Slot created.");
      }
      setDrawerOpen(false); router.refresh();
    });
  }
  function handleDelete(slot: Slot) {
    if (slot.is_booked) { show("Cannot delete a booked slot.", "error"); return; }
    if (!confirm("Delete this availability slot?")) return;
    startTransition(async () => {
      const res = await deleteAvailabilitySlot(fd({ id: slot.id }));
      if (res.error) { show(res.error, "error"); return; }
      setSlots((p) => p.filter((s) => s.id !== slot.id)); show("Slot deleted."); router.refresh();
    });
  }
  function handleTogglePublished(slot: Slot) {
    startTransition(async () => {
      const res = await toggleSlotPublished(fd({ id: slot.id, is_published: String(!slot.is_published) }));
      if (res.error) { show(res.error, "error"); return; }
      setSlots((p) => p.map((s) => (s.id === slot.id ? { ...s, is_published: !s.is_published } : s)));
    });
  }
  function handleAutoConfirm() {
    const next = !autoConfirm; setAutoConfirm(next);
    startTransition(async () => {
      const res = await toggleAutoConfirm(fd({ auto_confirm: String(next) }));
      if (res.error) { setAutoConfirm(!next); show(res.error, "error"); }
    });
  }

  const recurringByDay: Record<number, Slot[]> = {};
  const nonRecurring: Slot[] = [];
  for (const s of slots) {
    if (s.is_recurring && s.day_of_week != null) (recurringByDay[s.day_of_week] ??= []).push(s);
    else nonRecurring.push(s);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${toast.type === "error" ? "bg-error text-white" : "bg-success text-white"}`}>{toast.message}</div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal" style={{ fontFamily: "var(--font-heading, 'Cormorant Garamond', serif)" }}>My Availability</h1>
          <p className="text-sm text-gray-500 mt-1">Publish open slots for parent booking</p>
        </div>
        <button type="button" onClick={openAdd} className="rounded-md bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-dark-lavender transition-colors">+ Add Slot</button>
      </div>

      {/* Auto-confirm */}
      <div className="flex items-center gap-3 mb-6 rounded-lg border border-silver/60 bg-white px-4 py-3">
        <label className="text-sm text-charcoal font-medium flex-1">Auto-confirm parent bookings</label>
        <Toggle on={autoConfirm} onChange={handleAutoConfirm} />
      </div>

      {/* Grid */}
      {slots.length === 0 ? (
        <div className="text-center py-16"><p className="text-gray-400 text-sm">No availability slots. Add your first slot to allow parent self-booking.</p></div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-3 mb-8">
            {GRID_DAYS.map((day) => (
              <div key={day} className="min-w-0">
                <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wide mb-2 text-center">{DAY_NAMES[day]}</h3>
                <div className="space-y-2">
                  {(recurringByDay[day] || []).map((s) => <SlotCard key={s.id} slot={s} onEdit={openEdit} onDelete={handleDelete} onToggle={handleTogglePublished} />)}
                  {!(recurringByDay[day] || []).length && <p className="text-xs text-gray-300 text-center italic py-4">--</p>}
                </div>
              </div>
            ))}
          </div>
          {nonRecurring.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wide mb-3">Specific Date Slots</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {nonRecurring.map((s) => (
                  <div key={s.id}>
                    <p className="text-xs text-gray-500 mb-1">{s.specific_date}</p>
                    <SlotCard slot={s} onEdit={openEdit} onDelete={handleDelete} onToggle={handleTogglePublished} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-silver/60 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-silver/40">
              <h2 className="text-lg font-semibold text-charcoal" style={{ fontFamily: "var(--font-heading, 'Cormorant Garamond', serif)" }}>{editingSlot ? "Edit Slot" : "Add Slot"}</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-charcoal text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Slot Type</label>
                <SimpleSelect value={formType} onValueChange={setFormType} options={SLOT_TYPES} placeholder="Select type" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-charcoal">Recurring</label>
                <Toggle on={formRecurring} onChange={() => setFormRecurring(!formRecurring)} color="bg-lavender" />
              </div>
              {formRecurring ? (
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">Days</label>
                  <div className="flex flex-wrap gap-2">
                    {GRID_DAYS.map((day) => (
                      <button key={day} type="button" onClick={() => setFormDays((p) => p.includes(day) ? p.filter((d) => d !== day) : [...p, day])}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${formDays.includes(day) ? "bg-lavender text-white border-lavender" : "bg-white text-charcoal border-silver hover:border-lavender"}`}>
                        {DAY_NAMES[day]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Date</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={INPUT_CLS} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Start Time</label>
                  <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">End Time</label>
                  <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Max Students</label>
                <SimpleSelect value={formMax} onValueChange={setFormMax} options={MAX_OPTS} placeholder="Max" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-charcoal">Published</label>
                <Toggle on={formPublished} onChange={() => setFormPublished(!formPublished)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-silver/40">
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-md border border-silver px-4 py-2 text-sm font-medium text-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={handleSave} disabled={pending} className="rounded-md bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-dark-lavender transition-colors disabled:opacity-50">{pending ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
