# SESSION PICKUP

_Last rewritten: 2026-07-25 (end of session)_

---

## 0. Pre-session ritual — do not skip

Full protocol lives in `CLAUDE.md`. Short form:

- **Regular Terminal:** `git status`, then `git log --oneline -5`
- **Claude Code:** `/clear` before any work
- **Schema days only:** migration list check
- Supabase MCP is **read-only**. All DDL through `supabase db push` in Regular Terminal. No exceptions.

⚠️ `tsc --noEmit` currently reports **8 errors in `scripts/e2e-teardown.ts`** — pre-existing, unrelated to any schema work, and that file never ships. `app/` and `lib/` are clean. Add `scripts/` to `tsconfig.json` `exclude` to stop the noise.

---

## 1. Repo state

- **HEAD = this pickup commit**, pushed to `origin/main`. Fully synced.
- Verify: `git rev-list --count origin/main..HEAD` → expect `0`
- Working tree clean except `scripts/e2e-*.ts` — untracked scratch, **never commit these**.

**Shipped 2026-07-25:**

| Commit | What |
|---|---|
| `f2f1a0b` | Pickup note |
| `e3b8879` | Approvals nav link + codified untracked `platform_modules` state |
| `0233bc7` | Billing generalization spec v1 |
| `a044bb3` | Billing generalization spec **v2** (supersedes v1) |
| `85aae35` | **Phase A1 migration + regenerated types** |

---

## 2. Production state

**Live at `portal.balletacademyandmovement.com`, Stripe TEST MODE.**

Verified end-to-end 2026-07-24: `checkout → card vaulted → webhook 200`
Re-verified 2026-07-25 post-A1: cart add → cart renders with correct pricing.

### Stripe config (production Vercel env)

| Item | Value |
|---|---|
| Webhook endpoint | `BAM Platform Enrollment Webhook (test)` — test mode |
| Subscribed events | `checkout.session.completed` **only** |
| Signing secret / `sk_test` / `pk_test` | all in Vercel prod env |
| `NEXT_PUBLIC_APP_URL` | portal domain, **Production scope** |

- Old live-mode `pk_` rescued to Amanda's password manager.
- A live-mode webhook endpoint also exists (created in error, harmless in test mode). At go-live, reuse or recreate cleanly.
- **Go-live switch** is not piecemeal: swap `sk_`/`pk_`, repoint the signing secret, re-verify a real checkout.

### Known prod data

- Wyatt Cobb-Hardin has an active enrollment in Test Classes from 7/17 (`id 2fb3d183`, admin/seed path). This triggered the original 23505.
- A **Test Classes cart item was added 2026-07-25** during A1 smoke testing and may still be open. Clean it up.
- **Do not reuse Wyatt** for the approvals demo — use a student with no existing enrollment in the target class, or the queue lands empty.

---

## 3. What changed 2026-07-25

### 3.1 Approvals nav link — DONE
`/admin/enrollment/approvals` now appears under Students & Families (✓ glyph, `sort_order` 27). Verified live. Same migration codified two hand-applied `platform_modules` edits that existed in prod but in no migration.

### 3.2 Billing generalization spec v2 — COMMITTED
`docs/BILLING_GENERALIZATION_SPEC_V2.md`. Nine phases. Supersedes v1 (five of v1's schema assumptions were wrong; corrected in v2 §0).

Scope: family as billing anchor · admin placement (comp / manual / vault request) · multi-payer with per-charge splits · offline payments with partial allocation · processor-agnostic card vaulting · ledger tagging.

### 3.3 Phase A1 — APPLIED AND VERIFIED

Migration `20260725140000_billing_generalization_phase_a1.sql`:

- `enrollment_charge_items`: `enrollment_id` → nullable · added `description` · FKs on `family_id`/`student_id`/`class_id` (all still nullable) · `item_type` widened to 10 values including `costume`, `competition`, `late_fee`, `merchandise`
- `enrollment_cart_items`: `class_id` → nullable · added `item_type` (NOT NULL, DEFAULT `class_enrollment`), `reference_id`, `description`
- Ledger: dropped vestigial `invoice_id`/`payment_id`/`line_item_id` · renamed `1010` to "Cash – Processor Clearing" · added `1020 undeposited_funds`
- `productions`: added `tenant_id` NOT NULL + FK (NO ACTION) + index
- `timesheet_entries.production_id`: FK added, **ON DELETE NO ACTION** (protects production P&L labor attribution)

Types regenerated. `app/` and `lib/` typecheck clean.

---

## 4. Next session — start here

### 4.1 Phase A2 is BLOCKED, and why
A2 tightens `enrollment_charge_items.family_id` to NOT NULL. **Do not do this yet.** `lib/billing/approval-repo.ts:365` reads `enrollments.family_id` as explicitly nullable. A2 requires that value be guaranteed non-null at both writer sites first (`webhook/route.ts:491` and `approval-repo.ts:394`).

### 4.2 Recommended order
1. **Phase B** — `payment_methods` table; migrate off `families.stripe_*`; `family_payers`
2. **Phase C** — `charge_item_splits` + balance trigger
3. **Phase H** — RLS for payer visibility. **Ships with C, not after.** Splits without RLS expose payers to each other
4. **Phase D/E/F** — offline payments, admin card vaulting, placement modes

### 4.3 Amanda walkthrough
Approvals queue at `/admin/enrollment/approvals`. Needs a **fresh test enrollment** on a student with no existing enrollment in the target class.

---

## 5. Open questions for Amanda

| # | Question | Blocks |
|---|---|---|
| 1 | **Consent copy** — parents are consenting to costume/competition charges the platform cannot produce (live in prod). What should it say? | Nothing, but it's live |
| 2 | **Split billing** — confirmed needed, including grandparents. Does a non-parent payer need a portal login, or emailed receipts only? | Phase B design |
| 3 | **Sibling discounts** — ~50% off 2nd+ registration. Registration only, or tuition too? | Phase C |
| 4 | **Late fees** — charged at all? Automatic on aging or admin-applied? | Phase D |
| 5 | **Costume / competition fees** — per-student flat, or per-production? | Phase A2 |
| 6 | **Comp reasons** — require a picklist? (Recommend yes; `refunds.reason_id` is already NOT NULL) | Phase F |
| 7 | **Credit on account** — auto-apply to next charge, or admin-allocated? | Phase D |
| 8 | **Trial policy** — what, if anything, replaces the copy removed 2026-07-24? | Nothing |
| 9 | **Day-one reports** — which reports does she actually pull weekly in Studio Pro? | Reporting spec |
| 10 | **Newsletter / Klaviyo overlap** — deferred, don't lose it | — |

---

## 6. Backlog — see `docs/SESSION_2026-07-25_FINDINGS.md`

Newly documented, in priority order:

- **P0 — 41 tables lack `tenant_id`**, including `classes`, `profiles`, `teachers`, `attendance`, `studio_settings`. Needs its own spec. Blocks tenant-facing reporting entirely
- **P1 — `teacher_profiles` view hides departed teachers from payroll reports**, retroactively
- **P1 — `cancelled` vs `canceled`** split across six tables; silent zero-row filters
- **P1 — four money-state vocabularies** across `charges` / `charge_items` / `ledger_entries` / `refunds`
- **P2 — two attendance tables** (`attendance` unscoped, `attendance_records` scoped), both in active use
- **P2 — `productions` has no archive path** now that the FK blocks deletes

Carried from `SESSION_2026-07-21_FINDINGS.md`:

- Browse Classes "Request Enrollment" is a silent no-op (writes to nonexistent `admin_tasks`)
- Ended classes appear in the catalog (missing end-date filter)
- Vercel custom domains "Invalid Configuration" — check GoDaddy for conflicting A records on `portal`/`staging`
- `staging.` points at production; not a real second environment

---

## 7. Specs not yet written

| Spec | Trigger |
|---|---|
| **Tenant scoping remediation** | P0 above. Biggest architectural debt in the platform |
| **Reporting + semantic layer** | Investigated 2026-07-25 (findings §7). Build the metadata registry first; canned reports become definitions on top of it. BI export target is a versioned `reporting` schema of views, never raw tables |
| **Expense module** | No expense table exists. Five expense accounts with no way to post to them. Required before any real production P&L |
| **Private packages** | `item_type` already includes `private_pack`; `credit_accounts` exists (points-denominated, student-scoped) |
| **`ADMIN_TASK_CENTER`** | Amanda wants a task list spanning financial, payroll, billing, timesheets, alerts, evaluations. Also resolves the `admin_tasks` no-op defect |
