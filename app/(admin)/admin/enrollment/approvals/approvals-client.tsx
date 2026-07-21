"use client";

import { useState, useTransition } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { applyAdjustment, type AdjustmentType } from "@/lib/billing/adjustments";
import {
  approveEnrollmentAction,
  declineEnrollmentAction,
  promoteWaitlistEnrollmentAction,
  applyChargeItemAdjustmentAction,
  setChargeItemTimingAction,
  resetChargeItemAdjustmentAction,
} from "./actions";

// ── Types (shared with the server page) ──────────────────────────────────────────────

export interface AdjustmentLog {
  id: string;
  adjustment_type: string;
  value: number;
  reason: string;
  created_at: string;
}
export interface ChargeItem {
  id: string;
  item_type: string;
  recurrence_type: string;
  recommended_amount_cents: number;
  approved_amount_cents: number | null;
  charge_timing: string | null;
  status: string;
  proration: {
    full_month_cents?: number;
    deliverable_meetings_in_window?: number;
    meetings_in_cycle?: number;
    start_date?: string;
    next_anchor_date?: string;
  } | null;
  adjustments: AdjustmentLog[];
}
export interface PendingEnrollment {
  id: string;
  status: string;
  hold_expires_at: string | null;
  last_charge_error: string | null;
  student: { first_name: string; last_name: string } | null;
  klass: { name: string; day_of_week: number | null; start_time: string | null; end_time: string | null } | null;
  family: { family_name: string; hasVaultedPm: boolean } | null;
  items: ChargeItem[];
}
export interface WaitlistEnrollment {
  id: string;
  student: { first_name: string; last_name: string } | null;
  klass: { name: string } | null;
  family: { family_name: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const ITEM_LABEL: Record<string, string> = {
  registration: "Registration",
  first_tuition: "First tuition (prorated)",
  one_time_fee: "Fee",
  private_pack: "Private-lesson pack",
};

function netCents(item: ChargeItem): number {
  return item.approved_amount_cents ?? item.recommended_amount_cents;
}
function isAdjusted(item: ChargeItem): boolean {
  return item.approved_amount_cents != null || item.charge_timing === "deferred";
}

type Banner = { tone: "green" | "red" | "amber" | "gray"; text: string } | null;

const BANNER_TONE: Record<NonNullable<Banner>["tone"], string> = {
  green: "bg-green-50 border-green-200 text-green-800",
  red: "bg-red-50 border-red-200 text-red-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  gray: "bg-gray-50 border-gray-200 text-gray-700",
};

// ── Root ─────────────────────────────────────────────────────────────────────────────

export function ApprovalsClient({
  pending,
  waitlist,
}: {
  pending: PendingEnrollment[];
  waitlist: WaitlistEnrollment[];
}) {
  const [banner, setBanner] = useState<Banner>(null);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">Enrollment Approvals</h1>
        <p className="text-sm text-slate mt-1">
          Review pending enrollments, adjust charges, then approve or decline.
        </p>
      </div>

      {banner && (
        <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${BANNER_TONE[banner.tone]}`}>
          {banner.text}
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate py-12 text-center rounded-xl border border-dashed border-silver">
            No enrollments awaiting approval.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((e) => (
              <PendingCard key={e.id} enrollment={e} setBanner={setBanner} />
            ))}
          </div>
        )}
      </section>

      {waitlist.length > 0 && <WaitlistTable rows={waitlist} setBanner={setBanner} />}
    </>
  );
}

// ── Pending card ─────────────────────────────────────────────────────────────────────

function holdBadge(hold: string | null): { text: string; amber: boolean } | null {
  if (!hold) return null;
  const days = Math.ceil((new Date(hold).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "Hold expired", amber: true };
  if (days === 0) return { text: "Hold expires today", amber: true };
  return { text: `Hold expires in ${days}d`, amber: days < 2 };
}

function PendingCard({
  enrollment: e,
  setBanner,
}: {
  enrollment: PendingEnrollment;
  setBanner: (b: Banner) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const name = e.student ? `${e.student.first_name} ${e.student.last_name}` : "Unknown student";
  const chargeNowTotal = e.items
    .filter((it) => it.status !== "declined" && it.charge_timing !== "deferred")
    .reduce((sum, it) => sum + netCents(it), 0);
  const hold = holdBadge(e.hold_expires_at);

  function onApprove() {
    startTransition(async () => {
      const o = await approveEnrollmentAction(e.id);
      if (o.status === "approved") {
        setBanner(
          o.repairTasks.length === 0
            ? { tone: "green", text: `Approved ${name} — charged ${usd(o.chargedCents)}.` }
            : {
                tone: "amber",
                text: `Approved ${name} — charge succeeded (${usd(o.chargedCents)}), but ${o.repairTasks.length} follow-up write(s) need repair: ${o.repairTasks.map((r) => r.step).join(", ")}.`,
              }
        );
      } else if (o.status === "charge_failed") {
        setBanner({ tone: "red", text: `Charge failed for ${name}: ${o.error}. Enrollment stays pending.` });
      } else if (o.status === "already_processed") {
        setBanner(
          o.stuck
            ? { tone: "red", text: `${name}: charges created but no payment — needs manual retry.` }
            : { tone: "gray", text: `${name} was already processed.` }
        );
      } else {
        setBanner({ tone: "gray", text: `${name} is no longer pending (${o.actual}).` });
      }
    });
  }

  function onDecline() {
    if (!reason.trim()) return;
    startTransition(async () => {
      const o = await declineEnrollmentAction(e.id, reason.trim());
      setDeclining(false);
      setReason("");
      if (o.status === "declined") {
        setBanner({ tone: "gray", text: `Declined ${name}. The parent is notified their card was not charged.` });
      } else {
        setBanner({ tone: "gray", text: `${name} is no longer pending (${o.actual}).` });
      }
    });
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-medium text-charcoal">{name}</p>
          <p className="text-sm text-slate">
            {e.klass?.name ?? "—"}
            {e.family ? ` · ${e.family.family_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hold && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                hold.amber ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {hold.text}
            </span>
          )}
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              e.family?.hasVaultedPm ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {e.family?.hasVaultedPm ? "Card vaulted" : "No card on file"}
          </span>
        </div>
      </div>

      {e.last_charge_error && (
        <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          Last charge error: {e.last_charge_error}
        </p>
      )}

      <div className="mt-4 divide-y divide-silver border-y border-silver">
        {e.items.map((it) => (
          <ChargeItemEditor key={it.id} item={it} disabled={isPending} setBanner={setBanner} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-charcoal">
          Charge now: <span className="font-semibold">{usd(chargeNowTotal)}</span>
        </p>
        <div className="flex items-center gap-2">
          {declining ? (
            <div className="flex items-center gap-1.5">
              <input
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                placeholder="Reason (required)"
                className="border border-silver rounded px-2 py-1 text-xs w-48"
              />
              <button
                disabled={isPending || !reason.trim()}
                onClick={onDecline}
                className="rounded bg-red-600 text-white px-3 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
              >
                Confirm decline
              </button>
              <button
                disabled={isPending}
                onClick={() => {
                  setDeclining(false);
                  setReason("");
                }}
                className="rounded border border-silver px-2 py-1 text-xs text-slate hover:bg-cream"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                disabled={isPending}
                onClick={() => setDeclining(true)}
                className="rounded border border-red-300 text-red-700 px-3 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                disabled={isPending}
                onClick={onApprove}
                className="rounded bg-green-600 text-white px-4 py-1 text-xs font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Working…" : `Approve · ${usd(chargeNowTotal)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Per-item adjustment editor ───────────────────────────────────────────────────────

const TYPE_OPTS = [
  { value: "none", label: "No adjustment" },
  { value: "waive", label: "Waive (100% off)" },
  { value: "amount_off", label: "$ off" },
  { value: "percent_off", label: "% off" },
];

function ChargeItemEditor({
  item,
  disabled,
  setBanner,
}: {
  item: ChargeItem;
  disabled: boolean;
  setBanner: (b: Banner) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<"none" | AdjustmentType>("none");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const recurring = item.recurrence_type === "recurring";
  const deferred = item.charge_timing === "deferred";
  const num = Number(value);
  // Edge conversion: dollars → cents, percent → basis points.
  const converted =
    type === "amount_off" ? Math.round(num * 100) : type === "percent_off" ? Math.round(num * 100) : 0;
  const valueValid = type === "waive" || (Number.isFinite(num) && num > 0);
  const canApply = type !== "none" && reason.trim().length > 0 && valueValid && !disabled && !isPending;

  const previewCents =
    type === "none"
      ? netCents(item)
      : applyAdjustment(item.recommended_amount_cents, {
          type,
          value: converted,
          reason: "preview",
        });

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error);
      else onOk?.();
    });
  }

  const p = item.proration;

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-charcoal">
            {ITEM_LABEL[item.item_type] ?? item.item_type}
            {deferred && (
              <span className="ml-2 inline-block rounded-full bg-lavender/15 text-lavender-dark px-2 py-0.5 text-[11px] font-medium">
                Deferred to next draw
              </span>
            )}
          </p>
          {p && p.full_month_cents != null && (
            <p className="text-xs text-slate mt-0.5">
              {p.deliverable_meetings_in_window} of {p.meetings_in_cycle} meetings · full month{" "}
              {usd(p.full_month_cents)}
              {p.start_date ? ` · from ${p.start_date}` : ""}
            </p>
          )}
        </div>
        <div className="text-right">
          {isAdjusted(item) && item.approved_amount_cents != null ? (
            <p className="text-sm">
              <span className="text-slate line-through mr-1">{usd(item.recommended_amount_cents)}</span>
              <span className="font-semibold text-charcoal">{usd(item.approved_amount_cents)}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-charcoal">{usd(item.recommended_amount_cents)}</p>
          )}
          {isAdjusted(item) && (
            <button
              disabled={disabled || isPending}
              onClick={() => run(() => resetChargeItemAdjustmentAction({ chargeItemId: item.id }))}
              className="text-[11px] text-slate hover:text-charcoal underline disabled:opacity-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Adjustment controls */}
      <div className="mt-2 flex items-end gap-2 flex-wrap">
        <div className="w-36">
          <SimpleSelect
            value={type}
            onValueChange={(v) => setType(v as "none" | AdjustmentType)}
            options={TYPE_OPTS}
            placeholder="Adjustment"
          />
        </div>
        {(type === "amount_off" || type === "percent_off") && (
          <input
            type="number"
            min="0"
            step={type === "percent_off" ? "1" : "0.01"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "percent_off" ? "%" : "$"}
            className="border border-silver rounded px-2 py-1 text-xs w-20"
          />
        )}
        {type !== "none" && (
          <>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              className="border border-silver rounded px-2 py-1 text-xs w-44"
            />
            <span className="text-xs text-slate">→ {usd(previewCents)}</span>
            <button
              disabled={!canApply}
              onClick={() =>
                run(
                  () =>
                    applyChargeItemAdjustmentAction({
                      chargeItemId: item.id,
                      type: type as AdjustmentType,
                      value: converted,
                      reason: reason.trim(),
                    }),
                  () => {
                    setType("none");
                    setValue("");
                    setReason("");
                  }
                )
              }
              className="rounded bg-lavender text-white px-3 py-1 text-xs hover:bg-lavender-dark disabled:opacity-50"
            >
              Apply
            </button>
          </>
        )}
        {recurring && (
          <label className="flex items-center gap-1.5 text-xs text-slate ml-auto">
            <input
              type="checkbox"
              checked={deferred}
              disabled={disabled || isPending}
              onChange={() =>
                run(() => setChargeItemTimingAction({ chargeItemId: item.id, defer: !deferred }))
              }
            />
            Defer to next draw
          </label>
        )}
      </div>

      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}

// ── Waitlist table ───────────────────────────────────────────────────────────────────

function WaitlistTable({
  rows,
  setBanner,
}: {
  rows: WaitlistEnrollment[];
  setBanner: (b: Banner) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function onPromote(row: WaitlistEnrollment) {
    const name = row.student ? `${row.student.first_name} ${row.student.last_name}` : "Student";
    setBusyId(row.id);
    startTransition(async () => {
      const o = await promoteWaitlistEnrollmentAction(row.id);
      setBusyId(null);
      if (o.status === "promoted") {
        setBanner({ tone: "green", text: `Promoted ${name} to pending — charges generated, hold started.` });
      } else {
        setBanner({ tone: "gray", text: `${name} is no longer on the waitlist (${o.actual}).` });
      }
    });
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate mb-3">
        Waitlist ({rows.length})
      </h2>
      <div className="overflow-x-auto rounded-xl border border-silver">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left">
            <tr>
              <th className="px-4 py-2 font-medium text-charcoal">Student</th>
              <th className="px-4 py-2 font-medium text-charcoal">Class</th>
              <th className="px-4 py-2 font-medium text-charcoal">Family</th>
              <th className="px-4 py-2 font-medium text-charcoal">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silver bg-white">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  {r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}
                </td>
                <td className="px-4 py-2">{r.klass?.name ?? "—"}</td>
                <td className="px-4 py-2">{r.family?.family_name ?? "—"}</td>
                <td className="px-4 py-2">
                  <button
                    disabled={isPending && busyId === r.id}
                    onClick={() => onPromote(r)}
                    className="rounded bg-lavender text-white px-3 py-1 text-xs hover:bg-lavender-dark disabled:opacity-50"
                  >
                    {isPending && busyId === r.id ? "Promoting…" : "Promote"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
