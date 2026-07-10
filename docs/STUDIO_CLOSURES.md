# Studio Closures — Location Scoping & Overrides

**Status:** Draft spec — awaiting approval
**Last updated:** 2026-07-10
**Governs:** `studio_closures`, `closure_locations` (new), `private_sessions` (location + override), closure display surfaces, closure enforcement
**Related:** `docs/LOCATIONS_AND_FACILITIES.md` (location model), `_INDEX.md` task 19 (occurrence generator — gates class-side enforcement)

---

## 1. Purpose

Today a studio closure is tenant-wide (one date, no location) and **display-only** — it greys the day and shows a "Closed" badge, but cancels nothing. With multiple owned studios (San Clemente + RSM, and future locations), a closure must be able to target specific studios: all owned studios, or a chosen subset. And a closure should actually *suppress* what happens on that date, with controlled exceptions.

This spec adds: (a) location scoping to closures (all studios / multi-select, studios only), (b) real cancellation of **private lessons** at targeted studios with a per-private override, and (c) the **model + permission rules** for class-occurrence cancellation/override — whose actual enforcement is deferred to the occurrence generator (task 19).

**Honesty boundary:** closures currently cancel nothing. This spec makes the *privates* half real now; the *class* half is spec-now, build-when-task-19-lands. Nothing here should imply class cancellation works before the generator exists.

---

## 2. Current reality (from investigation)

- `studio_closures`: `id, tenant_id, closed_date, reason, created_at` — tenant-only, no location. 6 rows (Spring Break).
- **Display-only:** consumers grey the day + show "Closed"/badge (admin classes calendar, class-edit warning, parent dashboard list). No consumer cancels/skips/filters any occurrence. The occurrence generator ignores `studio_closures` entirely.
- `private_sessions`: **live, materialized per-occurrence** table with `status` + `cancellation_reason/cancelled_by/cancelled_at` (existing cancel concept the app already respects) and recurrence. 5 rows. **Location is free-text `studio` ("Studio 1"), not a FK.**
- Class occurrences: live in `schedule_instances` (frozen, no generator) or the phantom `class_sessions`. **Nothing to cancel until task 19.**

---

## 3. Data model

### studio_closures (modified)
- Add `all_studios boolean NOT NULL DEFAULT true`.
- `all_studios = true` → closure applies to every studio-type location (auto-includes future studios, zero code change).
- `all_studios = false` → applies only to the studios listed in `closure_locations`.

### closure_locations (new join table)
- `closure_id → studio_closures.id` (ON DELETE CASCADE), `location_id → studio_locations.id`.
- Populated only when `all_studios = false`. One row per targeted studio.
- **Rule:** only `location_type = 'studio'` may be referenced (never partner_venue/internal). Enforce in UI and save path.

### private_sessions (modified)
- Add `location_id uuid → studio_locations.id` (studio-type). **Prerequisite** for targeting privates by studio. Backfill the 5 existing free-text `studio` values to the matching San Clemente room's location.
- Add `overrides_closure boolean NOT NULL DEFAULT false` — when true, this private happens even if its studio is closed on its date.

**Why a join table, not nullable `location_id`:** the requirement is explicitly "All studios OR a multi-select." A join table + `all_studios` flag models one-closure→many-studios cleanly, keeps one row per date, scales to a 3rd studio for free, and expresses "all" alongside specific-studio closures. A nullable `location_id` cannot express "all" and would fan a multi-select into duplicate date rows.

---

## 4. Behavior

### Closure targeting (buildable now)
- Creating a closure defaults to **All Studios**. Staff may switch to "Specific studios" and multi-select from **studio-type locations only**.
- Display surfaces become location-aware: grey/badge only the **targeted** studios on that date, not the whole tenant.

### Privates enforcement (buildable now)
- For a closed (date × studio): each `private_session` at that studio on that date is suppressed (treated as cancelled) **unless** `overrides_closure = true`.
- Use the existing `status`/cancellation concept the app already excludes on.
- **Override permission:** any teacher who can schedule privates may set `overrides_closure` on a private session (it's their lesson). No admin gate.

### Class enforcement (model + permissions now; enforcement DEFERRED to task 19)
- Intended: for a closed (date × studio), class occurrences at that studio on that date are cancelled.
- **Override permission:** only `admin` / `super_admin` (Amanda) may override a class to run during a closure — NOT regular teachers. (Contrast with privates, which any scheduling teacher may override.)
- **DEFERRED:** there are no materialized class occurrences to cancel or override until the occurrence generator (task 19) exists. Until then, classes on closed dates get the existing read-time display treatment (grey/"Closed") only, now scoped to the targeted studios. The class-override permission rule is documented so it's ready to wire into the generator work; it does nothing until then.

---

## 5. Permissions summary

| Action | Who | Status |
|--------|-----|--------|
| Create/edit/delete a closure (all or specific studios) | admin / super_admin | Buildable now |
| Override a **private** to run during a closure (`overrides_closure` on the session) | any teacher who can schedule privates | Buildable now |
| Override a **class** to run during a closure | admin / super_admin only | Model + permission now; enforcement deferred (task 19) |

---

## 6. Build sequence

1. **Step A — schema:** `studio_closures.all_studios`; `closure_locations` join table; `private_sessions.location_id` + `overrides_closure`; backfill the 5 privates' free-text studio → location_id. One migration via `supabase db push` (Regular Terminal), then type regen. Pre-flight guards; verify with bam-schema-sync.
2. **Step B — closure CRUD + UI:** "All studios / specific studios" multi-select (studio-type only) in studio-calendar; persist via join table; make display surfaces (admin classes calendar, parent dashboard, class-edit warning) grey/badge only targeted studios.
3. **Step C — privates enforcement:** closures suppress privates at targeted studios on the date, with per-private `overrides_closure`; the override editable by any private-scheduling teacher. Respect existing `status='cancelled'` exclusion.
4. **Deferred (task 19):** class-occurrence cancellation on closure + admin/super_admin class override — wired into the occurrence generator when it lands.

---

## 7. Open items

- **Free-text privates location backfill:** 5 rows, all "Studio 1" today → map to San Clemente. Low-risk now; do it carefully as part of Step A (fragile if deferred until more privates exist).
- **Class override enforcement:** blocked on task 19. The permission rule (admin/super_admin only) is recorded here.
- **Recurring privates:** confirm whether `overrides_closure` applies per-occurrence or to a recurrence series — decide at Step C.
