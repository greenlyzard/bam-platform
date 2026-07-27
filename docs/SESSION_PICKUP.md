# SESSION PICKUP

_Last rewritten: 2026-07-26 (end of session)_

---

## 0. Pre-session ritual — do not skip

Full protocol lives in `CLAUDE.md`. Short form:

- **Regular Terminal:** `git status`, then `git log --oneline -5`
- **Claude Code:** `/clear` before any work
- **Schema days only:** migration list check
- Supabase MCP is **read-only**. All DDL through `supabase db push` in Regular Terminal. No exceptions.

`tsc --noEmit` now returns **zero errors** — `scripts/` was excluded from typechecking in `4b93aad`. If it reports anything, it is real.

Staging command that keeps the e2e scratch files out: `git add -A ':!scripts'`

---

## 1. Repo state

- **HEAD = this pickup commit**, pushed to `origin/main`. Fully synced.
- Verify: `git rev-list --count origin/main..HEAD` → expect `0`
- Clean tree except `scripts/e2e-*.ts` — untracked, **never commit these**.

**Fourteen commits landed 2026-07-26:**

| Commit | What |
|---|---|
| `e3b8879` | Approvals nav link + codified untracked `platform_modules` state |
| `0233bc7` → `a044bb3` | Billing generalization spec v1 → **v2** (v2 supersedes) |
| `85aae35` | **Billing Phase A1** — migration + regenerated types |
| `a836838` | Session findings + pickup note |
| `d340387` | **Five teacher timesheet blockers** |
| `b65b836` | Timesheet summary pay-period scoping |
| `466a477` | **Payroll employment-type classification** |
| `49cd5ca` | Owner classification + equity-draw separation |
| `e463d03` | Employment type editable from staff profile |
| `265c21b` | Staff-actions authorization + teachers row on add |
| `4b93aad` | Exclude `scripts/` from typecheck |
| `e1c9fab` | **Compensation authorization** — `requireFinance`, rate card RLS |
| `c7ea1ca` | `enhanced-actions` guards + studio_admin escalation closed |
| `ee73cf7` | Authorization on two **unauthenticated** settings actions |
| `36741f2` | **Guards on all remaining ~100 admin server actions** |
| `8626b5c` | Client-side date writes use local calendar date |
| `5526f66` | Tenant timezone spec |

---

## 2. Production state

**Live at `portal.balletacademyandmovement.com`, Stripe TEST MODE.**

Stripe config unchanged from 2026-07-24: test-mode webhook (`checkout.session.completed` only), `sk_test`/`pk_test`/signing secret in Vercel prod env, `NEXT_PUBLIC_APP_URL` = portal domain (Production scope). Old live `pk_` is in Amanda's password manager. A live-mode webhook endpoint exists (created in error, harmless in test mode).

**Go-live switch** is not piecemeal: swap `sk_`/`pk_`, repoint the signing secret, re-verify a real checkout.

### Verified working in production tonight

- Parent checkout → cart → correct pricing (post-A1)
- Teacher timesheets: add entry → edit → **delete** → submit
- Payroll: Amanda under **Owner Draws**, footer `1 (W-2: 0, 1099: 0, Owner: 1)`, excluded from Combined Total
- Employment Type control on the staff profile
- `/teach/privates` and `/teach/evaluations` still work under `requireTeacher()`

### Known prod data

- Wyatt Cobb-Hardin has an active enrollment in Test Classes from 7/17 (`2fb3d183`). **Do not reuse Wyatt** for the approvals demo — use a student with no existing enrollment in the target class.
- A Test Classes cart item from 2026-07-25 smoke testing may still be open.
- Amanda's and Derek's `employment_type` are both `owner`.

---

## 3. What shipped 2026-07-26

### 3.1 Billing Phase A1 — APPLIED
Charge items and cart items generalized (`enrollment_id` nullable, `description` added, `item_type` widened to 10 values including costume/competition/late_fee/merchandise). Ledger cleanup, `productions.tenant_id` added, `timesheet_entries.production_id` FK with NO ACTION.

**Phase A2 is BLOCKED.** Tightening `enrollment_charge_items.family_id` to NOT NULL requires `enrollments.family_id` be guaranteed non-null at both writer sites first — `approval-repo.ts:365` reads it as explicitly nullable.

### 3.2 Teacher timesheets — WORKING END TO END
Five blockers fixed. Four were the same bug: `.eq("user_id", …)` against `teacher_profiles`, a view with no `user_id` column. The fifth was a deadlock — the page picked the newest timesheet by `created_at`, so once approved, `isDraft` went false and the add-entry form vanished permanently.

**A sweep found nine instances of that bug. Three fixed, six remain (§5.2).**

### 3.3 Payroll classification
**Every teacher had been silently dropped from both W-2 and 1099 buckets since that code was written** — it compared `employment_type === "w2"`, but the CHECK constraint only permits `full_time | part_time | contract | employee | contractor_1099 | pending_classification`. No row ever held `"w2"`.

Fixed via shared `classifyEmployment()` in `lib/timesheets/employment.ts`. The same bug existed at four sites; one mislabeled every teacher as "W-2 Employee" in the admin entry drawer.

Added `owner` employment type → `owner_draw` payroll class. Equity distributions shown separately, excluded from wage totals and Combined Total.

### 3.4 Security — the big one

| Finding | Severity |
|---|---|
| `settings/studio` and `settings/disciplines` had **no authentication at all** — service-role writes callable by an unauthenticated request | Critical |
| `addStaffMember` had no authorization — any signed-in user could mint accounts with any role in any tenant | Critical |
| `upsertRateCard` had no authorization — any signed-in user could write compensation | Critical |
| Escalation check in `addStaffRole` omitted `studio_admin` and `studio_manager`, both in `is_admin()` — any signed-in user could grant themselves admin-tier access | Critical |
| `teachers_update_own` RLS let any teacher set their own pay rates | High |
| ~120 admin server actions checked `auth.getUser()` only | High |

**All closed.**

Mechanism worth remembering: **page and layout guards do not protect server actions.** The action executes, *then* the RSC tree re-renders — so `requireAdmin()` in a page body redirects after the write has already committed. Only code inside the action is an authorization boundary.

New: `requireFinance()` in `lib/auth/guards.ts` (finance_admin + super_admin), `has_finance_role()` in the DB, and an `ADMIN_TIER_ROLES` constant that `requireAdmin()` now spreads so the guard and the escalation check cannot drift apart again.

**Cara loses access** to the payroll report, pay-rates settings, rate cards, and CSV rate columns. Intended.

### 3.5 Dates — partially fixed
Six client-side write sites now use `toLocalDateStr()` from the new `lib/dates.ts`. Attendance and timesheet dates stop being written a day ahead after 5pm Pacific.

**Everything server-rendered is still UTC.** See `docs/TENANT_TIMEZONE_SPEC.md`.

---

## 4. Next session — recommended order

### 4.1 Timezone Phase A
`docs/TENANT_TIMEZONE_SPEC.md` §5. Add `tenants.timezone`, build the helpers, thread the zone through `AuthUser`. Everything else in that spec depends on it.

Phases E (schedule generation) and F (billing proration) are deliberately last — both currently work and both are load-bearing.

**Verification constraint:** this bug cannot be caught on a Pacific machine before 5pm. Use `TZ=UTC` locally or test the deployed environment after 5pm Pacific. Do not accept "works on my machine."

### 4.2 Cross-tenant authorization
~100 actions now have role guards but **none validate that a client-supplied `tenantId` or record `id` belongs to the caller's tenant.** Latent with one tenant, hard blocker before the second. Needs a `requireTenant()` helper plus call-site changes.

Related: `settings/studio/actions.ts` hardcodes `TENANT_ID` and `STUDIO_SETTINGS_ID` at module scope — a second tenant saving studio identity would silently overwrite BAM's row.

### 4.3 Billing Phase B
`payment_methods` table, migrate off `families.stripe_*`, `family_payers`. Then C (splits) + H (RLS) together — splits without RLS expose payers to each other.

---

## 5. Open defects

### 5.1 Amanda's class assignments don't render
`/admin/staff/[id]/profile` shows "No class assignments." She has three, visible at `/teach/evaluations`. The data is in `class_teachers`; the profile page query is wrong. **Uninvestigated.**

### 5.2 Six remaining `teacher_profiles.user_id` instances
- `lib/schedule/generate-sessions.ts:194-200` — session→teacher mapping silently empty
- `lib/queries/admin.ts:170-174` — also `welcome_sent_at`, a column that exists in **no table**
- `app/api/teachers/welcome/route.ts:114-116` — welcome tracking never persists; teachers can be re-emailed
- `admin/productions/[id]/page.tsx:44,52-54,95,101` — **production labor-cost report broken**
- `scripts/send-teacher-welcome-emails.ts`, `scripts/seed-teachers.ts` — both broken

### 5.3 Root cause of the above
`lib/supabase/server.ts:7` calls `createServerClient()` **without the `<Database>` generic**. Every query in the app is untyped — which is why nine queries against nonexistent columns compiled clean despite `types/database.types.ts` being regenerated religiously. Adding the generic will surface a wave of errors. That is the point. Its own session.

### 5.4 Rate resolution — must fix before real payroll
`rate_key` is never written by any code, `rate_amount` defaults to 0, `timesheets.total_pay` is never set. Pay is computed at **report time** from current `teachers.*_rate_cents`. So **changing a teacher's rate silently rewrites what past periods were worth.**

### 5.5 Carried forward
- Browse Classes "Request Enrollment" silent no-op (writes to nonexistent `admin_tasks`)
- Ended classes appear in catalog (missing end-date filter)
- Vercel custom domains "Invalid Configuration" — GoDaddy conflicting A records on `portal`/`staging`
- `staging.` points at production
- **41 tables lack `tenant_id`** incl. `classes`, `profiles`, `teachers`, `attendance` — see `SESSION_2026-07-25_FINDINGS.md`
- `teacher_profiles` view hides departed teachers from payroll retroactively
- `cancelled` vs `canceled` split across six tables
- `addStaffMember` is not atomic — failures are now *visible* but still partial
- `requireAdmin()` admits `finance_admin`, and the add-staff form can create `super_admin` — escalation within the admin tier
- `productions` has no archive path now that the timesheet FK blocks deletes
- `lib/auth/` holds five overlapping modules; the admin layout imports `requireRole` from a different one than everything else

---

## 6. Open questions for Amanda

| # | Question | Blocks |
|---|---|---|
| 1 | **Consent copy** — parents consent to costume/competition charges the platform cannot produce. Live in prod. | Nothing, but it's live |
| 2 | **Value communication** — showing families the worth of comped/donated time. Framing is her call; scholarships may need to be opt-in per family. | New spec |
| 3 | **Owner rate basis** — is her private hour valued at the family rate or an internal teaching rate? | Rate resolver |
| 4 | **Split billing** — confirmed needed incl. grandparents. Portal login or emailed receipts only? | Billing B |
| 5 | **Sibling discounts** — ~50% off 2nd+ registration. Registration only, or tuition too? | Billing C |
| 6 | **Late fees** — charged? Automatic on aging or admin-applied? | Billing D |
| 7 | **Costume/competition fees** — per-student flat or per-production? | Billing A2 |
| 8 | **Day-one reports** — which does she pull weekly in Studio Pro? | Reporting spec |
| 9 | **Trial policy** — what replaces the copy removed 2026-07-24? | Nothing |

---

## 7. Specs on file

| Spec | Status |
|---|---|
| `docs/BILLING_GENERALIZATION_SPEC_V2.md` | A1 done, A2 blocked, B–I open |
| `docs/TENANT_TIMEZONE_SPEC.md` | Phase A ready to build |
| `docs/SESSION_2026-07-25_FINDINGS.md` | P0 tenant scoping, reporting state |
| `docs/COMMUNICATIONS_HUB.md` | BAND replacement, partially built — **audit what shipped before building more** |

**Not yet written:** tenant scoping remediation (P0), reporting + semantic layer, expense module, private packages, `ADMIN_TASK_CENTER`, rate-at-entry-time resolver.

---

## 8. Parent Billing Portal — named deliverable

`/portal/billing` is a **"Coming soon" stub** in production today. It is the parent-facing counterpart to everything in `BILLING_GENERALIZATION_SPEC_V2.md`, and it is a go-live requirement: a parent with a vaulted card and no way to see what they owe or what they paid is not a shippable state.

### 8.1 What the page must do

| Capability | Depends on |
|---|---|
| Outstanding balance | `charge_items` with `payment_status` derived at read time (Phase A2) |
| Payment history — card **and** offline | `payment_receipts` + `receipt_allocations` (Phase D) |
| Manage payment methods — add, remove, set default | `payment_methods` table (Phase B) + processor-hosted elements (Phase E) |
| Pay an outstanding balance now | Payment request flow — see §8.2 |
| Per-payer scoping | RLS (Phase H) |

**Why it is still a stub:** the data model underneath it does not exist yet. Vaulting is currently three `families.stripe_*` columns — one card per family — so there is literally nothing to "manage." There is no table recording offline payments, and no allocation layer to compute what is still owed.

### 8.2 Payment request flow — belongs here

V2 §9 deferred the "payment request page" as a processor-agnostic replacement for Stripe-hosted invoices. **This is its home.** A native page showing what is owed with a pay button that routes through the tenant's configured processor adapter.

This is what makes **admin-placement "manual" mode actually collectable.** Today manual mode creates a charge item the family owes with no way for them to pay it online — an admin has to chase them. Without this page, manual mode is a spreadsheet with extra steps.

### 8.3 Ship-order constraint — do not violate

**Phase H (RLS) must land before or with this page, never after.**

Divorced parents and grandparent payers each need to see their own splits and nothing else. Shipping a billing portal before payer-scoped RLS means one parent sees the other's card on file, their payment history, and their split amounts. That is the defect that generates a phone call to Amanda, and it is not recoverable by apologising.

Concretely, before this page renders anything:
- `payment_methods` visible only to `owner_profile_id` + admins
- `charge_item_splits` visible only to `payer_profile_id` + admins
- `payment_receipts` visible only to `payer_profile_id` + admins
- Family-wide view gated on `family_payers.can_view_billing`

### 8.4 Effective build order

Parent billing is not a separate phase — it is the parent-facing render of B → C → D → E → H. Practical sequence:

1. **B** — `payment_methods`, `family_payers`
2. **C + H together** — splits and their RLS
3. **D** — receipts and allocations
4. **E** — processor-hosted card elements (the "manage" half of the page)
5. **Portal billing page** — read surfaces first (balance, history), then the pay action
6. **Payment request flow** — completes manual-mode collection

### 8.5 Copy problem to resolve first

The checkout consent text (v2 §1.2) currently promises charges for "registration, costumes, competitions, and adjustments" — two of which the platform cannot produce. That copy is live in production. A billing page that itemises charges will make the gap between promised and actual billing visible to parents on a screen built for scrutiny. **Amanda decision, and it should be settled before this page ships, not after.**

---

## 9. Standing principle — money surfaces

Anything that touches money gets verified end to end in production before it is called done, and gets its authorization and RLS checked in the same pass as its UI. Tonight established why:

- Every teacher was silently absent from payroll for months because a string comparison could never match
- Any teacher could set their own pay rate through the API
- Any signed-in user could write rate cards
- Rate changes silently rewrite what past pay periods were worth
- Attendance and timesheet dates were being written a day ahead every evening

None of these threw an error. All of them looked fine on screen. **For money surfaces, "the page renders" is not evidence of anything.**
