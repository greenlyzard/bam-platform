# Session Pickup Note

> Read this first each session, alongside `CLAUDE.md`. Run the Pre-Session Verification in
> `CLAUDE.md` §Pre-Session before doing anything. This note's claimed state must match reality.

_Last updated: 2026-07-23 (end of session)._

## Repo state to verify

- **23 commits ahead of `origin/main`; nothing pushed.** HEAD = the `docs: reconcile pickup note
  ahead-count (23)` commit.
  Clean working tree except two intentionally-untracked E2E scripts (`scripts/e2e-approve.ts`,
  `scripts/e2e-teardown.ts` — test-key guarded, do not commit).
- All work is **E2E- and click-verified** locally (portal add-to-cart → In Cart ✓ + indicator, cart
  page, enrollment-status visibility). The push is gated **only** on the prod Stripe config below.
- Key commits queued: `f9645f9` (write-path date-eligibility guards), `5228e73` (portal wired into
  vault spine), `912ca1c` (findings/docs).

## FIRST agenda item — Amanda session: prod Stripe config, THEN push

Do these **before** pushing (the deployed webhook + envs must be right before live commits land):

1. **Create the Stripe test-mode webhook endpoint** →
   `https://portal.balletacademyandmovement.com/api/enrollment/webhook`
   (events: `checkout.session.completed`, `checkout.session.expired`, `setup_intent.succeeded`).
   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
2. **Fix Vercel env — Stripe vars are miswired.** `STRIPE_SECRET_KEY` currently holds a **`pk_live_…`
   value** (a publishable *live* key in the secret slot — wrong and dangerous). Replace **all three**
   Stripe vars with **BAM test-mode** values:
   - `STRIPE_SECRET_KEY` = `sk_test_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_test_…`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_…` (from step 1)
   **Save the old `pk_live_…` value to Amanda's credential store** before overwriting (don't discard it).
3. **Verify `NEXT_PUBLIC_APP_URL` = the portal domain** (`https://portal.balletacademyandmovement.com`)
   — checkout success/cancel URLs and the customer email depend on it.
4. **Then push all 21 commits** to `origin/main` and **smoke-test the deployed checkout** end-to-end
   (add to cart → checkout → setup session → webhook creates a pending enrollment → approvals queue).

## Amanda question list (this session)

- **Trial/refund policy vs `refund_policy_enabled = false`** — the trial+refund promise appears on
  **three surfaces** (enroll flow, success page, received email) but the system enforces no refund
  window and registration is stated non-refundable. Reconcile the copy with the actual policy.
- **`trial_used`-conditional copy** — stop advertising a "free trial" to a student who already used
  one (server already blocks it; copy still promises it).
- **Sibling discount** — confirm **~50% off the 2nd+ registration** (percentage to confirm), and
  **whether it also applies to tuition** or registration only.
- **Admin-placement billing mode** — how billing is initiated when an admin places a student directly
  (charge items + intent outside the parent-checkout webhook path).
- _(Deferred, not active this session:)_ announcement-module vs **Klaviyo newsletter overlap** —
  logged under `SESSION_2026-07-21_FINDINGS.md` §8. The spec + build prompt have now landed in
  `docs/` (`ANNOUNCEMENT_MODULE_SPEC.md`, `ANNOUNCEMENT_MODULE_BUILD_PROMPT.md`); the build is
  sequenced **after Phase 3** and must reconcile with the partial announcements code already present,
  not build greenfield. Revisit the Klaviyo-overlap + Quo + casting-schema questions then.

## After push — next build priority

**Phase 3: the draw engine.** Off-session tuition draws on approved `tuition_schedule_intent`.
Hard requirements:
- **Catch-up semantics:** process every intent with `next_draw_at <= now` (not just exact-day
  matches) so a missed/late run still charges — idempotent per (intent, cycle).
- **Hold-expiry cron:** expire `pending` enrollment holds past `hold_expires_at` (release the
  capacity spot; §3.3) — pairs with the draw scheduler.

## Pointers

- Session findings & backlog: `docs/SESSION_2026-07-21_FINDINGS.md` (P1s now RESOLVED; §7 landmines,
  §8 intake-pending).
- Billing spec: `docs/BILLING_APPROVAL_AND_DRAW.md`; checkout: `docs/AUTHORIZATION_CHECKOUT.md`.
- Test-data teardown checklist: findings §6 (do **not** run yet).
