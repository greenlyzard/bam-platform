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

### P1 — Dead "Browse Classes" request path (phantom `admin_tasks`) — RESOLVED (5228e73)
**Resolved 2026-07-23.** Browse Classes now "Add to Cart" → the vault-checkout cart
(`POST /api/enrollment/cart`), not the phantom `admin_tasks` path; admins are notified via the webhook
on the resulting pending enrollment. `requestEnrollment`'s enrollment branch is deprecated (Trial
button only, pending Amanda), and the `pending_payment`→real `'pending'` duplicate-guard drift was
fixed across the four affected queries in the same slice. Original finding retained below for record.

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

### P1 — Portal has no route into the vault checkout spine — RESOLVED (5228e73, building on f9645f9)
**Resolved 2026-07-23.** The parent portal now reaches the spine directly: add-to-cart on Browse
Classes → `/portal/enrollment/cart` → `/api/enrollment/checkout` (same setup-session + webhook flow),
with a global portal cart indicator and cookie→`family_id` cart resolution. Write-path date-eligibility
guards (`isClassOpenForEnrollment`) landed first in **f9645f9**. Original finding retained below.

The Phase-1 cart → `mode:"setup"` session → webhook flow is reachable **only from the public route
group** (`app/(public)/enroll` → `/enroll/cart` → `/api/enrollment/checkout`, cart link from
`CartIndicator` in the public layout). The authenticated parent portal's "Browse Classes" leads into
the dead `admin_tasks` path above; the re-enroll chat (`/portal/enroll`) uses a **separate legacy**
`/api/enroll/create-payment-intent` path and can only bounce the parent out to public `/enroll`.
Net: a logged-in parent cannot reach the spine we built directly.

### Ended classes visible in catalog — RESOLVED (not a defect)
Re-investigated 2026-07-23. The catalog filter (`getClassCatalog`, `lib/queries/enroll.ts`) is
**correct** and behaves as designed — it already hides classes whose `end_date` is in the past
(`end_date.is.null,end_date.gte.today`). The one flagged class ("Beginning Hip Hop and Pom") was
**deliberately extended** to `end_date = 2026-12-05` and is genuinely live, so it correctly shows.
**Season labels do not bound dates by design** — a `2025/2026`-tagged class may legitimately run past
June; do not treat the season label as a date boundary.

**Hardening added** (the real gap): the date-eligibility rule was **list-only**. It is now enforced
server-side at the write paths via a shared helper `isClassOpenForEnrollment()`
(`lib/classes/status.ts`, unit-tested):
- `app/(public)/enroll/actions.ts` — `completeRegistration` (pre-flight, before any writes) and
  `enrollStudent` now reject ended classes with "This class has ended…".
- `app/api/enrollment/checkout/route.ts` — refuses the whole checkout (409) if any cart class has
  ended (defense in depth: carts go stale).
- Webhook (`app/api/enrollment/webhook/route.ts`) needs **no** separate guard — it only runs after
  `checkout.session.completed`, and checkout gates ended classes before the Stripe session exists, so
  an ended class can't reach it (documented in-code).

**Note:** `seasons.is_active` is currently **stale but inert** — it still flags the concluded
`2025/2026` season, but nothing reads it for enrollment eligibility, so it causes no bug. Do **not**
build eligibility on `seasons.is_active` (or `classes.status`, also unmaintained — all rows are
`'active'`) without first assigning a lifecycle owner to keep it accurate.

---

## 3. Copy / Policy — pending Amanda

- **Trial + refund promise — RESOLVED BY REMOVAL (2026-07-24).** The promise was live in production
  against `refund_policy_enabled = false` (pure admin-discretion, no window) with registration
  **stated non-refundable**, and was never approved by Amanda. It has been removed outright from all
  four surfaces that carried it — public cart (`app/(public)/enroll/cart/cart-view.tsx`), checkout
  success page (`app/(public)/enroll/success/success-view.tsx`), enrollment-received email
  (`lib/email/enrollment-received.ts`), and enrollment-confirmation email
  (`lib/email/enrollment-confirmation.ts`). The vault explanation (card saved, nothing charged today,
  registration + prorated first month at approval, tuition draws on the 15th) is unchanged. The
  **policy discussion with Amanda remains open** — what, if anything, replaces it is undecided; the
  replacement mechanism is the tenant policy engine (§4), not conditional copy. Nothing goes back on
  a parent-facing surface until Amanda defines the policy.
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
- **Cosmetic (post-5228e73 sweep):**
  - *Portal cart lines don't show the student.* Browse add-to-cart sends `student_id` but not
    `student_name`, and the cart view only renders "For: …" when `student_name` is set — so each line
    shows no dancer. Resolve the name from `student_id` (or send `student_name`) so lines are labeled.
  - *Browse-page subtitle is stale.* `/portal/enrollment` still reads "…request enrollment or a
    trial"; update the copy to reflect add-to-cart.
- **Tenant policy engine (Shopify-style)** — refund/trial/registration policies as tenant-editable
  structured settings with platform-provided safe defaults: a new tenant gets conservative default
  policy copy out of the box; admins edit policy text/parameters in settings (building on existing
  `studio_settings` flags: `refund_policy_enabled`, `refund_window_days`,
  `registration_stated_refundable`, plus a to-be-modeled trial policy); all checkout/cart/success/
  email surfaces render from settings automatically, never hardcoded. Spec after Amanda defines
  BAM's actual policy — hers becomes the first configured tenant, the defaults get designed for
  tenant #2. Today's copy removal (§3) is step zero (the current hardcoded promise is the
  anti-pattern this replaces).

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

- **Ledger group `73d58c74…` (test $112.50 entry) intentionally retained** — ledger is append-only by
  trigger; test-mode entries are identifiable by test-mode PI ids in posting keys. Before live launch,
  decide whether to start the ledger clean via superuser migration.

---

## 7. Schema landmines

- **`classes.level` does not exist — the column is `levels` (text[]).** Selecting `level` in a
  PostgREST embed does not error loudly; it makes the *whole embedded sub-select* return null, so a
  join silently yields **empty rows**. This caused today's cart bug: `/api/enrollment/cart`'s
  response builder embedded `class:classes(…, level, …)`, so `POST` returned an empty `items` array
  while the DB row existed — the Add-to-Cart button never flipped and the indicator never appeared
  (fixed in 5228e73: `level`→`levels`, and the client re-reads via GET). Same family as the known
  `profiles.full_name` (use `first_name`+`last_name`) and `enrollments.pending_payment` (not a real
  status — use `pending`) traps. **Rule:** verify every embedded column against
  `types/database.types.ts` before shipping a join.

---

## 8. Announcements/Communications module — spec landed, build deferred

- **Spec + build prompt landed 2026-07-23** — `docs/ANNOUNCEMENT_MODULE_SPEC.md` and
  `docs/ANNOUNCEMENT_MODULE_BUILD_PROMPT.md` are now in the repo (externally drafted).
  **Sequenced after Phase 3; do not act on the build prompt yet** — it's queued for a dedicated
  future session.
- **Not greenfield — must reconcile with existing code.** An announcements feature already exists
  partially in *code* (`components/communications/AnnouncementForm.tsx`,
  `app/api/communications/announcements`, `lib/communications/send-announcement.ts`, and the
  `…_add_sender_name_to_announcements` migration). The future discovery stage must **reconcile the
  spec against this partial implementation**, not build from scratch.
- **Open product questions (carry into that session):**
  - **Module vs Klaviyo overlap for newsletters** — Amanda decision (do announcements/newsletters
    live here or in Klaviyo, and where's the boundary).
  - **Quo carrier-registration status** — unknown; confirm before relying on SMS send.
  - **Casting phase needs a teams/productions schema that doesn't exist yet** — blocker for that part
    of the spec; scope the schema first.

---

*Generated 2026-07-21. E2E harness: `scripts/e2e-approve.ts` (uncommitted, test-key guarded).*
