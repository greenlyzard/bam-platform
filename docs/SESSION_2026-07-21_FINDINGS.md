# Session Findings — 2026-07-21

> Vault-only checkout (Phase 1) + enrollment approval engine (Phase 2) verified end-to-end in
> Stripe **test mode** against a live pending enrollment. Defect log, copy/policy decisions pending
> Amanda, billing backlog, and the test-data teardown list.

---

## 1. E2E Result — ✅ Phase 1 + Phase 2 verified end-to-end

A real parent-side checkout → webhook → admin approval was exercised against the live DB and Stripe
test API.

- **Checkout (Phase 1 spine):** cart → `mode:"setup"` Stripe session → `checkout.session.completed`
  webhook produced a **`pending`** enrollment (`ef648230-51eb-4e5d-a47d-1f5c4d41113b`, student
  "Test Student 2", class "Test Classes") with a 5-day hold, a vaulted card, a $50 registration +
  a correctly-prorated $62.50 first-tuition charge item, and a `pending_setup` intent
  ($125/mo, anchor 15, `next_draw_at` null).
- **Approval (Phase 2 engine):** `approveEnrollment` run via the REAL deps (`createAdminClient` →
  `createSupabaseApprovalRepo`, real Stripe gateway from `getStripe()`, real confirmation sender,
  `now = new Date()`) — harness `scripts/e2e-approve.ts` (test-key guarded, not on the runtime path).

**Outcome:** `{ status: "approved", paymentIntentId: "pi_3TvjLtQiqOLzH3So1Q6s0SS3",
chargedCents: 11250, repairTasks: [] }`.

**7/7 DB checks passed:**

| # | Check | Result |
|---|---|---|
| 1 | `charges` — 2 rows (registration 5000, first_tuition 6250), `succeeded`, `captured_at` set, PI present, `intent_id` patched onto first_tuition (`63ba6e05…`), null on registration | ✅ |
| 2 | Ledger group `73d58c74…` (`direct_sale_captured`) — **DR cash_clearing 11250 = CR revenue_registration 5000 + CR revenue_tuition 6250**, balanced | ✅ |
| 3 | `tuition_schedule_intent` — `active`, monthly 12500, anchor 15, `next_draw_at=2026-08-15`, deferred 0 | ✅ |
| 4 | `enrollment_charge_items` — both `charged` with charge_id backrefs | ✅ |
| 5 | `enrollments` — `active`, `approved_by=6518a096…` (Amanda), `approved_at` set | ✅ |
| 6 | `billing_tasks` — **zero** `approval_post_charge_repair` rows | ✅ |
| 7 | `classes.enrolled_count` ("Test Classes") advanced to 1 | ✅ |

Charge charge_id backrefs: registration → `4aadccdb…`, first_tuition → `487579bf…`.
Stripe charge: `ch_3TvjLtQiqOLzH3So1sWPL6aB`.

---

## 2. Defects

### P1 — Dead "Browse Classes" request path (phantom `admin_tasks`)
`/portal/enrollment` "Request Enrollment" → `requestEnrollment`
(`app/(portal)/portal/enrollment/actions.ts`) inserts into **`admin_tasks`**, a table that **does not
exist** in the live DB (only `approval_tasks` / `billing_tasks` exist). The insert is wrapped in a
`try/catch` that only `console.error`s, so the action **returns `success:true`** and shows
"Our team will review and confirm…" while creating **nothing**. The click's only real side effect is
an email to `dance@bamsocal.com`. Verified: zero `enrollments` / `enrollment_charge_items` /
`tuition_schedule_intent` / `enrollment_carts` created.
Secondary drift in the same action: duplicate-guard checks
`status IN ('active','trial','waitlist','pending_payment')` — **omits the new vault-only `'pending'`**;
reads `classes.max_enrollment`/`enrolled_count` (verify vs the `max_students` the Phase-1 capacity
gate uses).

### P1 — Portal has no route into the vault checkout spine
The Phase-1 cart → `mode:"setup"` session → webhook flow is reachable **only from the public route
group** (`app/(public)/enroll` → `/enroll/cart` → `/api/enrollment/checkout`, cart link from
`CartIndicator` in the public layout). The authenticated parent portal's "Browse Classes" leads into
the dead `admin_tasks` path above; the re-enroll chat (`/portal/enroll`) uses a **separate legacy**
`/api/enroll/create-payment-intent` path and can only bounce the parent out to public `/enroll`.
Net: a logged-in parent cannot reach the spine we built directly.

### P1 — Ended classes visible in catalog
Ended/past classes still appear in the Browse Classes catalog (`getClassCatalog`) — needs an
end_date / status filter so parents can't request enrollment into a finished class.

---

## 3. Copy / Policy — pending Amanda

- **Trial + refund promise appears on 3 surfaces** but the system is configured
  `refund_policy_enabled = false` (pure admin-discretion, no window) and registration is
  **stated non-refundable**. Reconcile the parent-facing copy with the actual policy on all three
  surfaces (enroll flow, success page, received email) — do not promise a refund window the system
  doesn't enforce.
- **Trial copy must be conditional on `students.trial_used`** — don't offer a "free trial" to a
  student who has already used one (the request action already blocks it server-side, but the copy
  still advertises it).
- **Success tab title** — confirm the desired browser tab title / heading on the post-checkout
  success page.

---

## 4. Parent UX — backlog

- **Student photo upload** on the student profile (parent-side).
- **Empty-state enroll CTA** — when a family has no enrollments, surface a clear call-to-action into
  the (correct, once fixed) enrollment flow instead of a blank state.

---

## 5. Billing features — to spec

- **Approval override / reversal**, including **super_admin authority** to reverse or override an
  approval decision (who can undo an activation/charge, and how it posts as a reversal group).
- **Admin-placement billing mode** — when an admin places a student directly (not parent checkout),
  define how billing is initiated (charge items + intent generation outside the webhook path).
- **Sibling discounts** — ~**50% off the 2nd+ registration** (percentage **pending Amanda's
  confirmation**); rides the adjustments rails (`percent_off`, bps).
- **Cross-checkout registration dedupe** — season-aware: a returning family that already paid
  registration this season shouldn't be recommended it again (currently per-checkout-session only;
  Phase-2 approval-time concern).
- **`charges.ledger_posting_key` backfill** — the approval engine posts the ledger group but leaves
  `charges.ledger_posting_key` null; populate the back-reference for reporting joins.
- **Verify/author admin-read RLS policies for §9 billing tables** (`charges`, `enrollment_charge_items`,
  `charge_item_adjustments`, `tuition_schedule_intent`, `billing_tasks`) — approvals page currently
  reads via service role.

---

## 6. Cleanup — test-data teardown

Full teardown of today's E2E test data before/at go-live prep:

- `enrollments` `ef648230-51eb-4e5d-a47d-1f5c4d41113b` (Test Student 2 / Test Classes).
- Its `enrollment_charge_items` (registration `4aadccdb…`, first_tuition `487579bf…`).
- Its `tuition_schedule_intent` (`63ba6e05…`).
- Its `charges` (registration + first_tuition, PI `pi_3TvjLtQiqOLzH3So1Q6s0SS3`).
- The `ledger_entry_groups` row `73d58c74…` + its `ledger_entries` legs
  (posting_key `stripe:pi_3TvjLtQiqOLzH3So1Q6s0SS3:direct_sale_captured`).
  **Note:** `ledger_entries`/`ledger_entry_groups` are UPDATE/DELETE-revoked from `anon`/`authenticated`
  and guarded by a balance trigger — deletion needs service role and may need the group removed as a
  unit; confirm the teardown approach rather than issuing ad-hoc deletes.
- Reset `classes.enrolled_count` for "Test Classes" (`9e8ea976…`) back to its pre-test value.
- Any `enrollment_carts` from the test checkout.
- The test student / family records if they were created solely for testing
  (student `6396973f…`, family `144b0cf1…`) — confirm they aren't reused elsewhere first.
- **Stripe (test mode):** the PaymentIntent/charge are historical test records (leave as-is);
  **detach the test payment method** and optionally delete the **test customer** on family
  `144b0cf1…` (`stripe_customer_id …QRy8`, `stripe_payment_method_id …Z8jl`) if the family record is
  torn down — and null the two columns on the family row if it is kept.

**Do not run any teardown yet** — this is the checklist only.

---

*Generated 2026-07-21. E2E harness: `scripts/e2e-approve.ts` (uncommitted, test-key guarded).*
