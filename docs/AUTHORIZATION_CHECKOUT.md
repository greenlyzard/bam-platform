# Authorization Checkout — Spec (Slice 1 of the Enrollment→Payment Bridge)

**Status:** Draft for build. **Depends on:** committed ledger foundation (`post_ledger_group`, `direct_sale_captured`), `app/api/enrollment/checkout/route.ts` (orphan — to be wired), `families.stripe_customer_id`.
**Supersedes:** the `/enroll` step-7 placeholder payment screen.

> This is the first and load-bearing slice of the enrollment→payment model. It captures the **open authorization** (card + ACH on file), charges **immediate** lines now, and lays the rails for **scheduled** tuition draws + off-session admin charges built in later slices.

---

## 1. The model (locked this session)

- Enrollment reaches a parent as an **approved item to check out** (admin approval → parent queue; queue UI is a later slice).
- At checkout the parent gives an **open authorization**: the studio may store the payment method and charge it on an ongoing basis (tuition draws, admin one-offs). This is card-on-file + ACH mandate — same as Dance Studio Pro.
- Every chargeable line carries **`charge_timing` = `immediate` | `scheduled`** (admin-set; defaults: registration fee / costume / competition → `immediate`; tuition → `scheduled`).
- **Checkout does three things:** (a) capture the open authorization against the family's Stripe Customer, (b) charge all `immediate` lines now, (c) record intent to schedule `scheduled` lines (the 15th draw engine consumes this in a later slice).

## 2. Scope of THIS slice (keep tight)

**In:**
1. Real Stripe Checkout Session that **vaults the payment method** for reuse: card via `setup_future_usage: 'off_session'`; ACH via `us_bank_account` with mandate. `payment_method_types: ['card','us_bank_account']`.
2. Persist the vaulted method + mandate to the family's Stripe Customer (`families.stripe_customer_id`; create the Customer if missing).
3. Charge the `immediate` lines (e.g. registration fee) in this session; post `direct_sale_captured` to the ledger via the existing webhook path.
4. Record `scheduled` lines as pending tuition-schedule intent (a row the later 15th engine reads) — **do not charge them now**.
5. Wire a **real checkout entry point** replacing the `/enroll` step-7 placeholder: on reaching payment, create the session server-side and redirect to Stripe.
6. Consent/disclosure text at the Terms step covering card-on-file + ACH mandate (open authorization).

**Out (later slices, name them so they're not forgotten):**
- Admin approval → parent queue UI.
- The 15th tuition-draw cron + off-session pulls.
- Admin-initiated off-session one-off charges (costume/competition after checkout).
- Multi-student / multi-line cart UX polish.

## 3. Data / fields

- `families.stripe_customer_id` — reuse; create Customer if null, persist id.
- Checkout line shape must carry `charge_timing` (`immediate|scheduled`), `line_type`, `amount_cents`, dims (student/class/family). If the cart/enrollment tables lack `charge_timing`, add it (guarded migration) defaulting per §1.
- A `tuition_schedule_intent` (or reuse the planned `tuition_charges` staging) row per `scheduled` line: family, student, class, monthly_amount_cents, anchor_day=15, status='pending_setup'. Minimal — the draw engine slice fleshes it out.
- Store the vaulted `payment_method` id + mandate id on the family (or a `family_payment_methods` row) so later off-session charges can reference it.

## 4. Flow

1. Parent hits Payment step for an approved enrollment (or, for this slice, any test enrollment with priced lines).
2. Server builds the line set, splits by `charge_timing`.
3. Create/fetch Stripe Customer for the family.
4. Create Checkout Session: `mode: 'payment'` with `payment_intent_data.setup_future_usage: 'off_session'` (card) **and** `payment_method_types` incl. `us_bank_account` (ACH mandate). Line items = the `immediate` lines. Metadata = family/enrollment/tenant + a list of `scheduled` intents. `customer` = the family's Stripe Customer.
5. Redirect to Stripe. Parent authorizes (card `4242…` / test ACH), which both **charges immediate lines** and **saves the method + mandate**.
6. Webhook (`checkout.session.completed` for card; `async_payment_succeeded` for ACH — reuse existing ACH gating):
   - Persist the vaulted payment method + mandate to the family.
   - Post `direct_sale_captured` for the immediate lines (existing path).
   - Materialize the `scheduled` intents to `pending_setup` (no charge).
7. Confirmation.

## 5. Ledger

- Immediate lines → `direct_sale_captured` (cash_clearing DR / revenue CR), receipt-simple, already built.
- Scheduled lines → **no ledger entry at checkout** (nothing owed/paid yet; the 15th run posts when it draws).
- Registration fee immediate line → `revenue_registration` (confirm account slug exists in chart; add if missing).

## 6. Consent (Terms step)

Show, and require agreement to, language authorizing: storing the payment method, charging it for scheduled tuition on the 15th, and charging it for studio-approved fees (costumes, competitions, adjustments). Card-on-file + Nacha ACH mandate wording. **Flag for counsel/accountant** — exact wording, not a launch blocker for test mode.

## 7. Test plan

1. `stripe listen` running; test keys set (done).
2. Reach the real payment step for an enrollment with a registration-fee `immediate` line + a tuition `scheduled` line.
3. Pay with card `4242 4242 4242 4242` → confirm: (a) redirect to Stripe worked, (b) immediate reg fee charged, (c) payment method saved on the family, (d) ledger shows ONE `direct_sale_captured` group (cash = revenue), (e) scheduled tuition intent recorded, not charged.
4. Repeat with test ACH (`110000000` / `000123456789`) → confirm async gating + mandate saved.
5. **Success = the pipe is proven on the correct, model-aligned flow**, with an open authorization on file.

## 8. Guardrails (build)

- Follow bam-schema-sync. Any schema change = ONE guarded migration, no forward FKs.
- Do not apply/db push/deploy/commit — show diffs, run tsc + tests, then give regular-terminal commands and STOP.
- Reuse the existing `post_ledger_group` + webhook; don't fork a second ledger path.
