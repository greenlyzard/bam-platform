# SESSION PICKUP

_Last rewritten: 2026-07-25_

---

## 0. Pre-session ritual — do not skip

Full protocol lives in `CLAUDE.md`. Short form:

- **Regular Terminal:** `git status`, then `git log --oneline -5`
- **Claude Code:** `/clear` before any work (stale context has bitten us)
- **Schema days only:** check the migration list before touching anything
- Supabase MCP is **read-only**. All DDL goes through `supabase db push` in Regular Terminal. No exceptions.

---

## 1. Repo state

- **HEAD = this pickup commit**, pushed to `origin/main`. Fully synced, 0 commits ahead.
- Verify: `git rev-list --count origin/main..HEAD` → expect `0`
- Everything through `9602fd0` is on origin. **Phases 1 + 2 are pushed** — the standing "they ship together" rule is satisfied and retired.
- Working tree is clean except `scripts/e2e-*.ts` — untracked scratch, **never commit these**.

---

## 2. Production state — the headline

**The platform is deployed and LIVE at `portal.balletacademyandmovement.com`, running against Stripe TEST MODE.**

Verified end-to-end in production on 2026-07-24:

`checkout → card vaulted → webhook 200`

### Stripe configuration (production Vercel env)

| Item | Value |
|---|---|
| Webhook endpoint | `BAM Platform Enrollment Webhook (test)` — test mode |
| Subscribed events | `checkout.session.completed` **only** |
| Signing secret | in Vercel prod env |
| Secret key | `sk_test_…` in Vercel prod env |
| Publishable key | `pk_test_…` in Vercel prod env |
| `NEXT_PUBLIC_APP_URL` | portal domain, **Production scope** |

- The old **live-mode `pk_`** was rescued and handed to Amanda's password manager.
- A **live-mode webhook endpoint also exists** — created in error, harmless while we're in test mode. At go-live, either reuse it or delete and recreate cleanly.

### Go-live switch (not yet scheduled)

Flipping to live mode means: swap `sk_`/`pk_` in Vercel prod, point the signing secret at the live endpoint, re-verify a real checkout. Do not do this piecemeal.

---

## 3. Fixes shipped 2026-07-24 (both deployed)

**1. Trial/refund promise removed from all four surfaces**
Public cart, success page, and both transactional emails. The copy was promising a refund policy against `refund_policy_enabled=false`. Removal is the stopgap; the real fix is a **tenant policy engine** — specced in the findings backlog, still unbuilt.

**2. Webhook `23505` duplicate-key fix — proven**
Root cause: a **global** unique constraint on `(student_id, class_id)` colliding with what the handler assumed was **session-scoped** dedupe. The handler now **skips** pre-existing enrollments instead of 500-looping.

- Proof: Stripe event resend → `200 {created: 0, skipped: 1}`
- Cart now also guards duplicate adds client-side (`409`)

---

## 4. Known production data state

- **One completed test cart:** Wyatt / "Test Classes". All items skipped, so **no enrollment was created** — but the card **was vaulted** on the Cobb family.
- **Wyatt has a pre-existing active enrollment** in Test Classes from 7/17 (`id 2fb3d183`, created via the admin/seed path). This is exactly what triggered the `23505`.

**Open decision:** keep this as demo data for Amanda's walkthrough, or tear it down. If keeping, do **not** reuse Wyatt for the approvals demo (see §5.1).

---

## 5. Next session priorities

### 5.1 Amanda walkthrough — approvals queue
Route: `/admin/enrollment/approvals`

Needs a **fresh test enrollment** first. Use a student with **no existing enrollment in the target class**, or you'll reproduce the skip path and land in an empty queue.

### 5.2 Amanda — still-open questions
- **Sibling discounts** — ~50% off 2nd+ *registration* per Amanda. Confirm scope: registration fee only, or does tuition get a break too? (Phase 3.)
- **Admin-placement billing mode** — no vaulted card. Pay-link vs. comp/manual flag. Needs her call.
- **Trial policy** — what, if anything, replaces the copy removed in §3.1.
- **Newsletter / Klaviyo overlap** — deferred, but don't lose it.

### 5.3 Phase 3 build
- **Draw engine** — MUST use `next_draw_at <= now` catch-up selection per §5.3 of the billing spec. Not a "runs today" filter; missed draws have to be picked up.
- **Hold-expiry cron**

### 5.4 Small but blocking-ish
- **Approvals queue has no admin nav link.** The page exists and works; nothing points at it. Amanda cannot find it on her own.

---

## 6. Carried-over defects (unchanged)

See `docs/SESSION_2026-07-21_FINDINGS.md`.

- Browse Classes "Request Enrollment" is a silent no-op (writes to nonexistent `admin_tasks`)
- Parent portal still has no route into the vault checkout spine
- Ended classes appear in the catalog (missing end-date filter)
- Vercel custom domains showing "Invalid Configuration" — check GoDaddy for conflicting A records on `portal`/`staging`
- `staging.` currently points at production; not a real second environment
