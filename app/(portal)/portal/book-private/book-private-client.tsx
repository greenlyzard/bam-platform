"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { bookPrivateSession } from "./actions";
import Link from "next/link";

interface ApprovedTeacher {
  id: string; approvalId: string; name: string;
  avatarUrl: string | null; slotCount: number; studentIds: string[];
}
interface FamilyStudent { id: string; name: string; level: string | null; }
interface Slot {
  id: string; day_of_week: number | null; specific_date: string | null;
  start_time: string; end_time: string; is_recurring: boolean;
  slot_type: string; displayDate: string; sortKey: string;
}
interface Props {
  approvedTeachers: ApprovedTeacher[]; familyStudents: FamilyStudent[];
  tenantId: string; familyId: string;
}

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function fmt12(t: string) {
  const [hh, mm] = t.split(":"); const h = parseInt(hh, 10);
  const s = h >= 12 ? "pm" : "am", d = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mm === "00" ? `${d}${s}` : `${d}:${mm}${s}`;
}
function dur(a: string, b: string) {
  const [sh,sm] = a.split(":").map(Number), [eh,em] = b.split(":").map(Number);
  return (eh*60+em)-(sh*60+sm);
}
function fmtDate(ds: string) {
  const d = new Date(ds + "T00:00:00");
  return `${DAYS[d.getDay()]}, ${d.toLocaleString("en-US",{month:"long"})} ${d.getDate()}`;
}
function nextDates(dow: number, n: number) {
  const r: string[] = [], today = new Date();
  let gap = dow - today.getDay(); if (gap <= 0) gap += 7;
  for (let i = 0; i < n; i++) {
    const d = new Date(today); d.setDate(d.getDate() + gap + i * 7);
    r.push(d.toISOString().slice(0, 10));
  } return r;
}
function badge(t: string) { return t === "pilates" ? "Pilates" : t === "any" ? "Any" : "Private"; }
function ini(n: string) { return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2); }
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between py-1"><span className="text-slate">{label}</span><span className="font-medium text-charcoal">{value}</span></div>;
}
function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} className="mb-4 text-sm text-lavender hover:text-dark-lavender transition">&larr; {label}</button>;
}

export function BookPrivateClient({ approvedTeachers, familyStudents, tenantId }: Props) {
  const [step, setStep] = useState(1);
  const [teacher, setTeacher] = useState<ApprovedTeacher | null>(null);
  const [student, setStudent] = useState<FamilyStudent | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    if (step !== 3 || !teacher) return;
    let off = false; setLoading(true); setError(null);
    (async () => {
      const sb = createClient();
      const { data, error: e } = await sb.from("teacher_availability")
        .select("id, day_of_week, specific_date, start_time, end_time, is_recurring, slot_type")
        .eq("teacher_id", teacher.id).eq("is_published", true).eq("is_booked", false)
        .order("start_time", { ascending: true });
      if (off) return;
      if (e) { setError("Failed to load available times."); setLoading(false); return; }
      const exp: Slot[] = [];
      for (const r of data ?? []) {
        if (r.specific_date) {
          exp.push({ ...r, displayDate: fmtDate(r.specific_date), sortKey: r.specific_date });
        } else if (r.is_recurring && r.day_of_week !== null) {
          for (const dt of nextDates(r.day_of_week, 4))
            exp.push({ ...r, displayDate: fmtDate(dt), sortKey: dt, specific_date: dt });
        }
      }
      exp.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.start_time.localeCompare(b.start_time));
      if (!off) { setSlots(exp); setLoading(false); }
    })();
    return () => { off = true; };
  }, [step, teacher]);

  async function handleBook() {
    if (!teacher || !student || !slot) return;
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.set("tenant_id", tenantId); fd.set("student_id", student.id);
    fd.set("teacher_id", teacher.id); fd.set("slot_id", slot.id);
    const r = await bookPrivateSession(fd);
    if ("error" in r && r.error) { setError(r.error); setLoading(false); return; }
    setResult({ id: r.id!, status: r.status! }); setLoading(false);
  }

  const eligible = teacher?.studentIds.length
    ? familyStudents.filter(s => teacher.studentIds.includes(s.id)) : familyStudents;

  const grouped: Record<string, Slot[]> = {};
  for (const s of slots) { (grouped[s.sortKey] ??= []).push(s); }

  // ── Success ────────────────────────────────────────────────
  if (result) {
    const ok = result.status === "confirmed";
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-lavender/20 text-lavender">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-heading font-semibold text-charcoal">
          {ok ? "Booking Confirmed!" : "Booking Requested!"}
        </h2>
        <p className="mt-2 text-sm text-slate max-w-sm">
          {ok ? `Your private with ${teacher?.name} is confirmed.`
               : `Your request has been sent to ${teacher?.name}. You will be notified once confirmed.`}
        </p>
        <div className="mt-4 rounded-lg border border-silver/50 bg-white p-4 text-left text-sm w-full max-w-xs">
          <Row label="Teacher" value={teacher?.name ?? ""} />
          <Row label="Dancer" value={student?.name ?? ""} />
          <Row label="Date" value={slot?.displayDate ?? ""} />
          <Row label="Time" value={slot ? `${fmt12(slot.start_time)} \u2013 ${fmt12(slot.end_time)}` : ""} />
        </div>
        <Link href="/portal/dashboard"
          className="mt-6 inline-block rounded-md bg-lavender px-6 py-2 text-sm font-medium text-white transition hover:bg-dark-lavender">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const stepLabels = ["Teacher", "Dancer", "Time", "Confirm"];
  const card = "flex items-center gap-4 rounded-lg border border-silver/50 bg-white p-4 text-left transition hover:border-lavender hover:shadow-sm";

  return (
    <div>
      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {stepLabels.map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ${
              i+1 === step ? "bg-lavender text-white" : i+1 < step ? "bg-lavender/20 text-lavender" : "bg-silver/30 text-slate"}`}>
              {i+1 < step ? "\u2713" : i+1}
            </div>
            <span className={`hidden text-xs sm:inline ${i+1 === step ? "font-medium text-charcoal" : "text-slate"}`}>{l}</span>
            {i < 3 && <div className="mx-1 h-px w-6 bg-silver/50" />}
          </div>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Step 1 — Teacher */}
      {step === 1 && (
        <div>
          <h2 className="mb-4 text-lg font-heading font-semibold text-charcoal">Select a Teacher</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {approvedTeachers.map(t => (
              <button key={t.id} onClick={() => { setTeacher(t); setStep(2); }} className={card}>
                {t.avatarUrl
                  ? <img src={t.avatarUrl} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
                  : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender/15 text-sm font-medium text-lavender">{ini(t.name)}</div>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-charcoal truncate">{t.name}</p>
                  <p className="text-xs text-slate">{t.slotCount === 0 ? "No open slots" : `${t.slotCount} open slot${t.slotCount === 1 ? "" : "s"}`}</p>
                </div>
                {t.slotCount > 0 && <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-lavender/15 px-2 text-xs font-medium text-lavender">{t.slotCount}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Student */}
      {step === 2 && (
        <div>
          <Back onClick={() => { setStep(1); setTeacher(null); }} label="Change teacher" />
          <h2 className="mb-4 text-lg font-heading font-semibold text-charcoal">Select a Dancer</h2>
          {eligible.length === 0
            ? <p className="text-sm text-slate">No dancers approved for booking with {teacher?.name}. Contact the studio.</p>
            : <div className="grid gap-3 sm:grid-cols-2">
                {eligible.map(s => (
                  <button key={s.id} onClick={() => { setStudent(s); setStep(3); }} className={card}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-sm font-medium text-gold">{ini(s.name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-charcoal truncate">{s.name}</p>
                      {s.level && <p className="text-xs text-slate">{s.level}</p>}
                    </div>
                  </button>
                ))}
              </div>}
        </div>
      )}

      {/* Step 3 — Time */}
      {step === 3 && (
        <div>
          <Back onClick={() => { setStep(2); setStudent(null); setSlots([]); }} label="Change dancer" />
          <h2 className="mb-4 text-lg font-heading font-semibold text-charcoal">Pick a Time</h2>
          <p className="mb-4 text-sm text-slate">Booking with {teacher?.name} for {student?.name}</p>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
              <span className="ml-3 text-sm text-slate">Loading available times...</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate">No open time slots available. Check back later or contact the studio.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([dk, gs]) => (
                <div key={dk}>
                  <h3 className="mb-2 text-sm font-medium text-charcoal">{gs[0].displayDate}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {gs.map(s => (
                      <button key={`${s.id}-${s.sortKey}`} onClick={() => { setSlot(s); setStep(4); }}
                        className="flex items-center justify-between rounded-lg border border-silver/50 bg-white px-4 py-3 text-left transition hover:border-lavender hover:shadow-sm">
                        <div>
                          <p className="font-medium text-charcoal">{fmt12(s.start_time)} &ndash; {fmt12(s.end_time)}</p>
                          <p className="text-xs text-slate">{dur(s.start_time, s.end_time)} min</p>
                        </div>
                        <span className="rounded-full bg-lavender/10 px-2.5 py-0.5 text-xs font-medium text-lavender">{badge(s.slot_type)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Confirm */}
      {step === 4 && slot && (
        <div>
          <Back onClick={() => { setStep(3); setSlot(null); }} label="Change time" />
          <h2 className="mb-4 text-lg font-heading font-semibold text-charcoal">Confirm Your Booking</h2>
          <div className="rounded-lg border border-silver/50 bg-white p-5">
            <div className="space-y-3 text-sm">
              <Row label="Teacher" value={teacher?.name ?? ""} />
              <Row label="Dancer" value={student?.name ?? ""} />
              <Row label="Date" value={slot.displayDate} />
              <Row label="Time" value={`${fmt12(slot.start_time)} \u2013 ${fmt12(slot.end_time)}`} />
              <Row label="Duration" value={`${dur(slot.start_time, slot.end_time)} min`} />
              <Row label="Type" value={badge(slot.slot_type)} />
            </div>
            <div className="mt-4 rounded-md bg-cream/60 px-3 py-2 text-xs text-slate">
              Your teacher will confirm this booking shortly. You will receive a notification once confirmed.
            </div>
            <button onClick={handleBook} disabled={loading}
              className="mt-5 w-full rounded-md bg-lavender px-4 py-2.5 text-sm font-medium text-white transition hover:bg-dark-lavender disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Submitting..." : "Request Booking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
