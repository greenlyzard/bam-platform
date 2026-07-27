# Financial Anomaly Detection & Admin Alerting

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-27
**Investigated against live DB and codebase:** 2026-07-27

---

## 1. The question that produced this

> *If a family gets double-charged, or a private lesson is billed but never happened, does anyone find out — and how?*

**No. Not until a parent complains, or until someone manually scans the Stripe dashboard.**

That is not an acceptable state for a system that moves money, and it is a go-live blocker.

---

## 2. Findings

### 2.1 Every notification ever created is unread — all 88 of them

The `notifications` table works. Fourteen call sites write to it. Nothing renders it to an admin.

| | Finding |
|---|---|
| Table | `notifications(id, tenant_id, recipient_id, notification_type, title, body, metadata, is_read, read_at, created_at)` |
| Writers | 14 sites — enroll, book-private, absences, documents, document-expiry cron, late-pickup cron, attendance, teach/privates, admin/privates, admin/timesheets, communications inbound, placements release, admin-pending-enrollment |
| Reader API | `GET /api/notifications` — current user's unread |
| Consumers of that API | **Zero.** Nothing fetches it |
| UI reading the table directly | `components/mobile-bottom-nav.tsx` (unread badge), `teach/dashboard/page.tsx` |
| Where `MobileBottomNav` renders | `app/(portal)/layout.tsx` **only — parents** |
| Admin nav | Home, Timesheets, Comms, Students. **No bell, no alerts, no inbox** |
| `/admin/settings/notifications` | Linked from `admin/settings/page.tsx:24` — **route does not exist** |

Live data:

| type | rows | unread | recipients | range |
|---|---|---|---|---|
| `private_lesson` | 85 | **85** | admin, super_admin, teacher, (no role) | 2026-03-31 → 04-09 |
| `enrollment_pending` | 3 | **3** | admin, super_admin | 2026-07-21 |

**Three enrollment-pending alerts addressed to Amanda have sat unread since July 21** because no admin surface renders them.

**Dead code that would fail silently.** `lib/notifications/send.ts` — a multi-channel sender with in-app/push/email/SMS fan-out — has **zero callers**, and its `sendInApp` inserts `user_id`, `type`, `icon`, `data`, none of which exist on the live table (`recipient_id`, `notification_type`, `metadata`). It would throw, and the throw is swallowed by a `console.warn`. Wiring it up as-is would produce silent no-ops.

**Email:** the only admin-directed Resend path is `weekly-digest`, and its recipients are parents (`to: parent.email`). **Nothing reaches an admin by email today.**

### 2.2 `billing_tasks` is write-only

The repair mechanism for post-charge failures files reports nobody reads.

```
billing_tasks(id, tenant_id, type, intent_id, enrollment_id, family_id,
              status default 'open', payload jsonb,
              created_at, resolved_at, resolved_by)
CHECK status IN ('open','resolved')
INDEX (tenant_id, status)
```

| | |
|---|---|
| Creates rows | One site — `lib/billing/approval-repo.ts:277`, via `lib/billing/approval.ts:318`, when a post-charge step fails |
| Resolves rows | **Nothing.** No `.update()`, no writer of `resolved_at`/`resolved_by` |
| UI | **None.** No page, component, or route references the table |
| Live rows | 0 |

The index on `(tenant_id, status)` anticipates a queue view that was never built. The only thing that reads these rows today is a human writing SQL.

### 2.3 Double-charge protection is one partial index

| Table | Unique constraints beyond PK |
|---|---|
| `charges` | `uq_charges_intent_period (intent_id, billing_period) WHERE kind = 'monthly_tuition'` |
| `enrollment_charge_items` | **None** |
| `ledger_entries` | **None** |
| `refunds` | **None** |
| `private_session_billing` | `UNIQUE (session_id, student_id)` |

The database prevents exactly one double-charge shape: the same intent charged twice for the same monthly tuition period. That is the recurring-draw case, and it is genuinely protected.

**Everything else is unprotected.** Nothing stops two `charges` rows for the same `enrollment_id`. Nothing stops the same `enrollment_charge_items` row being charged twice — no unique key, no `charged_at`/`charge_id` uniqueness to make it idempotent. Any non-`monthly_tuition` kind (approval charges, fees, one-offs) has no constraint at all.

**And no detection layer at all** — no query, view, report, or cron looking for duplicate charges.

### 2.4 Privates: billed but not delivered, and already drifted

`cancelPrivateSession` (`admin/privates/actions.ts:657`) and `updatePrivateSessionStatus` (`:745` — the one that sets `no_show`) both update `private_sessions` only. **Neither reads or touches `private_session_billing`.** No void, no flag, no notification, no `billing_tasks` row.

Structurally confirmed: across the entire codebase there are **two INSERTs into `private_session_billing` and zero UPDATEs**. `billing_status` is write-once at `'pending'`; `paid_at` and `transaction_id` are never written by any code path.

**A cancelled or no-show session keeps its billing row, at full `amount_owed`, in `pending`, forever** — and no mechanism short of manual SQL could change it.

Unlike the checkout path, **this one has already run**, and live data is inconsistent:

| session_date | session_status | billing_status | amount_owed |
|---|---|---|---|
| 2026-04-09 | completed | pending | 150.00 |
| 2026-04-10 | scheduled | pending | 0.00 |
| 2026-04-07 | scheduled | *(no billing row)* | — |
| 2026-04-08 | completed | *(no billing row)* | — |
| 2026-04-09 | completed | *(no billing row)* | — |

Two completed sessions have no billing row. One scheduled future session already has one. A completed session has sat `pending` at $150 for three months.

### 2.5 No reconciliation of any kind

- **No Stripe read-back.** No `stripe.charges.list`, `paymentIntents.list`, `balanceTransactions`, or `payouts` calls anywhere. Stripe is only ever called to *create*, never to read back.
- **The five Vercel crons** are `resource-recommendations`, `weekly-digest`, `late-pickup-check`, `process-scheduled-releases`, `schedule-generate`. **None financial.**
- **`scripts/`** holds seeds, imports, an e2e pair, and a welcome-email sender. Nothing reconciling.
- Every `reconcil*` hit in the repo is schedule or locations reconciliation, unrelated to money.

No ledger-vs-settlement check. No charges-vs-processor check. No totals assertion.

### 2.6 What Amanda would actually see

If a family is double-charged in production today:

| Surface | Would it show? |
|---|---|
| In-app admin notification | **No** — admin has no notification UI; the bell exists only in the parent layout |
| Email to admin | **No** — the only Resend cron mails parents |
| `billing_tasks` queue | **No** — no UI, and a duplicate charge wouldn't create a task anyway |
| Admin dashboard | **No** — its only alert is `payroll.pendingCount` |
| Admin billing page | Would list both charges as separate rows, neither marked anomalous |
| DB constraint blocking it | Only if same intent + same month + `kind='monthly_tuition'` |
| Reconciliation report | Does not exist |
| Stripe dashboard | **Yes** — but only if someone opens it and recognizes two charges as one family |

**Time to detection:**
- Parent-visible double charge → **days**, bounded by the parent noticing their card statement.
- Billed-but-not-delivered private → **effectively unbounded.** The parent has no reason to complain about a charge for a lesson they may not remember was cancelled, no admin surface shows the mismatch, and the billing row cannot self-correct. The 2026-04-09 row has been standing for three months.

### 2.7 Scope caveat — read this before prioritising

`charges`, `enrollment_charge_items`, and `refunds` all have **0 live rows**. The checkout/approval billing path has never executed in production. §2.3 describes what the code *would* do, not what it has done.

**The privates path (§2.4) has run, and is already inconsistent.** That is the one with live damage.

---

## 3. Proposed design

### 3.1 Admin notification surface — smallest useful fix

The table works and has 88 rows waiting. The gap is purely presentational.

- Bell in the admin nav, unread count, dropdown listing recent notifications, mark-as-read.
- Reuse the existing `GET /api/notifications` route (currently zero consumers) rather than querying the table from a component — the API already scopes to the current user.
- **Do not** wire up `lib/notifications/send.ts` without fixing its column names first (§2.1). It would fail silently.

This alone would surface Amanda's three pending-enrollment alerts and every future one.

### 3.2 `billing_tasks` queue

A page at `/admin/billing/tasks` (or a tab on the billing page when that exists) listing `status='open'` tasks for the tenant, with a resolve action writing `resolved_at`/`resolved_by`. The index already exists for this query.

Pair with a notification on task creation — a repair task nobody sees is the current failure mode, and a queue nobody visits reproduces it.

### 3.3 Double-charge prevention — constraints first, detection second

**Prevention** (cheap, and the tables are empty so it is free right now):

- Unique partial index on `charges` for the approval path, mirroring `uq_charges_intent_period`'s shape
- Idempotency on `enrollment_charge_items` → `charges`: once an item has a `charge_id`, it cannot get a second one

> ⚠️ The exact constraint shapes need designing against `BILLING_GENERALIZATION_SPEC_V2.md` — splits change what "the same charge" means. A charge item split across three payers legitimately produces three charges. Do not add a naive unique on `charge_item_id`.

**Detection** (for what constraints can't catch):

A daily cron flagging: multiple charges for one enrollment in a short window; charge items charged more than their approved amount; ledger groups that reference the same source twice. Findings become `billing_tasks` rows, which become notifications.

### 3.4 Privates billing lifecycle

The concrete fix for §2.4:

- `cancelPrivateSession` and `updatePrivateSessionStatus` must reconcile `private_session_billing` when moving a session to `cancelled` or `no_show`.
- What "reconcile" means is **Amanda's policy call, not a developer's** — a late cancellation may legitimately still be billable. Options: void, flag for review, or apply a cancellation policy. Note `teacher_rate_cards` already has a `cancellation_policy` field, which suggests the intent existed.
- `billing_status` needs its remaining transitions written by *something* — `paid_at` and `transaction_id` have never been populated by any code.
- **Backfill the existing drift** (§2.4 table) once the policy is decided. Five rows, needs Amanda's eyes on each.

### 3.5 Processor reconciliation

A daily cron pulling Stripe `balanceTransactions` for the prior day and comparing to `charges` + `ledger_entries`. Mismatches in either direction become `billing_tasks`.

This is the only mechanism that catches a charge that happened at the processor but not in the platform, or vice versa. It is also the one that requires the most care with the pluggable-processor requirement — the comparison logic belongs behind the same adapter interface as everything else in `BILLING_GENERALIZATION_SPEC_V2.md` §5.

---

## 4. Build order

| Phase | Scope | Blocks |
|---|---|---|
| **1** | Admin notification bell + dropdown (§3.1) | Nothing — table and API already exist |
| **2** | Privates billing lifecycle + backfill (§3.4) | **Live data is already wrong.** Needs an Amanda decision first |
| **3** | `billing_tasks` queue UI (§3.2) | Phase 1 (for the notification pairing) |
| **4** | Double-charge constraints (§3.3, prevention half) | Should land before the checkout path carries real money |
| **5** | Anomaly detection cron (§3.3, detection half) | Phases 3 + 4 |
| **6** | Processor reconciliation (§3.5) | Phase 3 |

**Phase 1 is the highest value per hour of work in this document.** Everything else produces alerts; Phase 1 is what makes an alert visible at all.

**Phase 2 is the most urgent by damage** — it is the only one where production data is already inconsistent.

---

## 5. Open questions for Amanda

1. **Cancellation policy for privates.** When a private is cancelled or no-showed, is it billable? Does it depend on notice given? This gates §3.4 entirely.
2. **The five drifted rows** (§2.4) — each needs a call on whether it should have been billed.
3. **Alert channel.** In-app only, or email too? Email means she finds out without opening the platform, which matters for a double charge.
4. **Alert threshold.** Should every `billing_task` notify, or only certain types? A queue that cries wolf gets ignored, which is how we got here.

---

## 6. Related

- `docs/BILLING_GENERALIZATION_SPEC_V2.md` — splits change what a duplicate charge means (§3.3)
- `docs/SESSION_2026-07-25_FINDINGS.md` — the admin enrollment paths that create no billing artifacts
- `docs/PAYROLL_CORRECTNESS_AND_REPORTING.md` — the payroll half of the same problem
