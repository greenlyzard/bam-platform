# Enrollment Entry — Unified Paths (Parent & Admin)

**Status:** Draft for build. **Depends on:** Slice 1 (authorization checkout, in progress) — the shared checkout all paths funnel into. **Relates to:** Admin-Composed Carts (next spec), Performance Hub.

> The session surfaced the root problem: there is **no clean way to START an enrollment**. The `/enroll` chat forces everyone (even logged-in parents) through account creation and persists nothing; admins have no "enroll a student" action at all; the working path (`/enroll/cart`) is undiscoverable. This spec unifies entry around **one cart**, differing only by who builds it and how they're authenticated.

---

## 1. Principle: one cart, many doors

Every path produces the same object — an **enrollment cart** (classes + bundles + fees + upsells) that funnels into the **same authorization checkout** (Slice 1). The paths differ only in *who assembles the cart* and *whether they must authenticate/create an account*. Build the cart model once; add thin entry doors.

Cart is always tied to a **family** and one or more **students**. Checkout captures the open authorization, charges `immediate` lines, schedules `scheduled` lines.

---

## 2. The three doors

### 2.1 Returning parent (has account + student) — the biggest current gap
Logged-in parent should reach a cart in **2 clicks**, skipping account creation and (optionally) placement:
- Entry: "Enroll" from **My Dashboard / My Students**.
- Pick an **existing student** (no re-entry of dancer info).
- Browse classes **filtered to that student's level + age + active season** (see §4 — no expired classes).
- Add classes / bundles / recommended upsells → cart → checkout (Slice 1).
- If the family already has an **authorization on file**, checkout can be one-tap (charge immediate lines against the stored method; schedule tuition) — no re-vaulting.

*Fix:* the current chat's forced "Create Account" step must be **skipped when a session exists**. A logged-in parent never sees account creation.

### 2.2 New parent (no account) — the guided flow
Keep the guided experience, but it must persist and reach payment:
- account → dancer info → choose class → contact → terms (authorization consent) → **real** payment (Slice 1) → confirmation.
- Persists family + student + cart at each step (today it holds everything in memory and dead-ends — that's the `/enroll` chat bug).
- New students may route through **placement/assessment** (existing concept) before class choice; returning students skip it.

### 2.3 Admin, on a family's behalf
Admin needs a first-class "enroll" action (absent today):
- From a **student** or **family** page: "Build enrollment / cart."
- Admin assembles classes + bundles + fees + upsells (this is the seed of the **Admin-Composed Carts** engine).
- Then either: **charge now** (if authorization on file, off-session) **or** **push to the parent** to authorize + pay.
- Per-cart approval control (admin decides whether a parent-built cart needs admin release before checkout).

---

## 3. Auth & identity rules

- **Logged-in parent:** family + student resolved from session; never re-create account; may add a *new* student inline.
- **New visitor:** account creation required once; becomes a returning parent thereafter.
- **Admin:** acts on behalf of a chosen family; the cart is stamped `created_by = admin`, `on_behalf_of_family_id`. Admin actions that charge use the family's stored authorization (off-session), never a new card entry by the admin.
- All carts carry `family_id` (the fix for the orphan-cart problem — the chat created none).

---

## 4. Season & eligibility scoping (blocks the expired-class problem)

Every class list — parent or admin — defaults to the **active season** and filters by the **student's age/level eligibility**. Expired classes (ended 6/15) never appear by default; an admin can toggle "show past/all" for history. (This is the season-scoping item already banked; enrollment is where it bites first.)

---

## 5. What Slice 1 already gives us (don't rebuild)

- The **cart → authorization checkout** for the logged-in-parent-with-family path (`/enroll/cart`).
- Method vaulting + immediate/scheduled split + ledger posting.

So this spec's build is mostly **entry doors + skip-logic + admin action**, not new checkout.

---

## 6. Build slices (ordered, after Slice 1 proves the pipe)

1. **Returning-parent fast path** — "Enroll" from dashboard → pick existing student → season/eligibility-filtered classes → existing cart/checkout. Skip account creation when session exists. *(Highest value, smallest build — reuses Slice 1 end-to-end.)*
2. **Fix the new-parent guided flow** — make the chat/wizard persist family+student+cart and hand off to the real checkout (retire the dead `create-payment-intent` stub). Or: make the cart/wizard the primary flow and demote the chat to a guide.
3. **Admin enroll action** — "Build cart" from student/family page → charge-now (auth on file) or push-to-parent. Seeds the Admin-Composed Carts engine.
4. **One-tap re-checkout** — returning family with authorization on file charges without re-vaulting.

---

## 7. Punch-list items this resolves (banked during the session)

- No admin path to enroll a student → §2.3.
- `/enroll` chat persists nothing / dead-ends at 400 → §2.2 / slice 2.
- Logged-in parents forced through account creation → §2.1.
- Expired classes enrollable → §4.
- Cart has no `family_id` (orphan) → §3.

---

## 8. Open decisions (later, non-blocking)

- Placement/assessment: required for all new students, or admin-waivable? (Existing "new students start with a placement assessment" copy suggests required-but-skippable.)
- Can a parent build a cart freely, or only accept admin-recommended carts? (Ties to per-cart approval control — admin's toggle.)
- Bulk push (admin → many families) — belongs to the Admin-Composed Carts spec.
