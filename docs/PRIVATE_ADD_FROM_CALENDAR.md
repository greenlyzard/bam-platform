# PRIVATE_ADD_FROM_CALENDAR.md
# Ballet Academy and Movement — Add a Private from the admin Calendar
# Status: Ready to build (spec-first, per §0 ritual)
# Created: 2026-08-04 | Owner: Derek Shaw
# Related (authoritative): PRIVATE_LESSONS.md (owns privates), COMMUNICATIONS_HUB.md (privacy naming)
# Related (context): PRIVATE_LESSON_BILLING_AND_CREDITS.md, TENANT_TIMEZONE_SPEC.md, STUDIO_CLOSURES.md
# Deprecated — do NOT build from: CALENDAR_AND_SCHEDULING.md, UNIFIED_SCHEDULE.md

---

## 1. Problem

An admin cannot add a private lesson from the Calendar, and a private that *is*
created never appears on the Calendar at all.

Verified 2026-08-04 against the live code (not assumed — this is the exact spot
the pickup warns about):

- `lib/schedule/queries.ts::getScheduleInstances` reads `schedule_instances`,
  `classes`, `productions`, `rooms`, etc. It does **not** read `private_sessions`.
- `app/(admin)/admin/privates/actions.ts::createPrivateSession` inserts into
  `private_sessions` (+ billing, notifications, credit_transactions). It does
  **not** write a `schedule_instances` row.
- `schedule-calendar.tsx` already renders `event_type === 'private_lesson'`
  (purple `#A855F7`, "Private" label). That branch is currently unreachable —
  no such rows exist, and nothing produces them.

So `private_sessions` and the Calendar are two islands. This is "rung 3
unreachable — no link between `schedule_instances` and `private_sessions`" from
SESSION_PICKUP.md §7.

The add-private form itself is **not** the problem — it already exists and is
reused unchanged: `+ New Private` on `/admin/privates` →
`/admin/privates/new` → `components/admin/private-session-form.tsx` →
`createPrivateSession`.

---

## 2. Decisions (locked with Derek 2026-08-04)

| # | Decision |
|---|---|
| D1 | **Union at read.** The Calendar feed also reads `private_sessions` and maps them into calendar events at query time. **No `schedule_instances` rows are written for privates** — `private_sessions` stays the single source of truth. Rejected: write-through duplication (two tables to keep in sync on every edit/cancel/recurrence — the drift pattern the pickup keeps getting bitten by). |
| D2 | **Conflict = warn but allow.** On save, if the room or teacher is already booked in that window, show a clear warning listing the clashes and let the admin save anyway. Never block. |
| D3 | **Click an empty slot to add.** Clicking an empty room/time cell on `/admin/schedule` opens the existing New Private form pre-filled with that date, start time, and studio/room. |
| D4 | **Billing chosen per private.** The `billing_model` choice stays explicit in the form each time (`split_equal` / `split_custom` / `full_per_student` / `comp` / `bundle`). No silent auto-charge on create; existing credit-check UI stays. |
| D5 | **Target surface is `/admin/schedule`** (the live Calendar the nav points to), not the orphaned `/admin/calendar`. |
| D6 | **Privacy naming preserved.** On the Calendar a private renders as "Private Reservation — [Teacher]", never the student name, per COMMUNICATIONS_HUB.md. Honor the student's privates-visibility flag. |

---

## 3. Read path — union private_sessions into the Calendar (D1)

The week feed for `/admin/schedule` gains a second source. Two viable seams;
prefer the one that keeps the merge inside the existing query layer:

1. **Preferred:** extend `getScheduleInstances(...)` to also fetch
   `private_sessions` in the same tenant + week range and map each into the
   existing calendar-event shape, tagged `source: 'private'`.
2. Alternative: fetch privates in `app/(admin)/admin/schedule/page.tsx` and
   merge before passing to `ScheduleCalendar`. Only if (1) proves awkward.

### 3.1 Field mapping (private_sessions → calendar event)

| Calendar event field | private_sessions source | Notes |
|---|---|---|
| `event_date` | `session_date` | |
| `start_time` / `end_time` | `start_time` / `end_time` | `duration_minutes` is derivable, not authoritative |
| `event_type` | constant `'private_lesson'` | drives the purple render + label already in `schedule-calendar.tsx` |
| room / column | `location_id` → room; else free-text `studio` | privates carry free-text `studio` and often no `room_id` (see `schedule-calendar.tsx:606`). By-Room placement must tolerate a free-text studio that maps to no room column → render in an "Other / unroomed" lane, do not drop it |
| teacher | `primary_teacher_id` (+ `co_teacher_ids`) | |
| title (display) | **"Private Reservation — [Teacher]"** | D6. Never student name on the calendar |
| status filter | exclude `status IN ('cancelled', ...)` as classes do | keep cancelled out of the operational day unless a "show cancelled" filter is on, matching class behavior |
| id | `private:{private_sessions.id}` | namespaced so click-through routes to the private, not a class |

### 3.2 Recurrence

`is_recurring` + `recurrence_rule` privates must be **expanded within the
requested week** the same way classes are, so a weekly private shows every week
— not only on its seed date. Reuse the existing occurrence/week expansion
approach; do not invent a second one. If expansion is non-trivial this phase,
ship one-off privates first and list recurring expansion as a follow-up (state
it in the PR, do not silently drop it).

### 3.3 Location filter

Privates respect the top-right location filter (SC / RSM / All) via
`location_id`. A private with only free-text `studio` and no `location_id`
appears under "All" and is flagged, not hidden.

---

## 4. Add-from-slot interaction (D3)

- `schedule-calendar.tsx`: an empty region of a room/day column is clickable.
  Clicking computes `{ date, start_time, studio/room }` from the cell and opens
  the New Private flow pre-filled.
- Prefill transport: query params on the existing route, e.g.
  `/admin/privates/new?date=YYYY-MM-DD&start=HH:MM&studio=Studio%201&location_id=…`
  (optionally `&teacher=` when a By-Teacher column is clicked). The form reads
  these as initial state. A modal over the calendar is acceptable later; the
  prefilled route is the smaller first step and reuses the page as-is.
- End time defaults from the form's existing duration auto-calc (default 60 min).
- Timezone: derive the clicked time in the tenant timezone
  (TENANT_TIMEZONE_SPEC.md), not the browser's.

---

## 5. Conflict check — warn but allow (D2)

- A server-side helper checks the proposed `{date, start, end, room/studio,
  teacher}` against overlaps in **both** sources:
  - `schedule_instances` (classes, rehearsals, performances) — same room and/or
    same teacher, overlapping window, not cancelled.
  - other `private_sessions` — same room/studio and/or same teacher.
- Overlap = `existing.start < proposed.end AND proposed.start < existing.end`
  (matches the prototype's detector).
- Result surfaces in the form **before final insert**: a soft warning listing
  each clash ("Studio 1 — Beginner Ballet 4:30–5:30 (Deborah)") with a
  **"Save anyway"** confirm. Room clash and teacher clash are reported
  separately so the admin knows which.
- This never blocks; it informs. Matches how the prototype flags the real
  Studio 1 Mon 4:15–5:30 clash.

---

## 6. Non-goals (explicit, to prevent scope drift)

- **No `schedule_instances` rows for privates** (D1). If a future need forces
  materialization, that is a new decision, not this spec.
- No change to parent self-booking of teacher availability slots
  (PRIVATE_LESSONS.md §3.4) — that flow already exists and is separate.
- No touching the orphaned `/admin/calendar` (D5).
- No billing automation beyond the existing per-private choice (D4).

---

## 7. Files to touch

| File | Change |
|---|---|
| `lib/schedule/queries.ts` | `getScheduleInstances`: also fetch + map `private_sessions` for the week (§3) |
| `app/(admin)/admin/schedule/schedule-calendar.tsx` | empty-cell click → open prefilled new-private (§4); confirm private render/placement incl. unroomed lane (§3.1) |
| `components/admin/private-session-form.tsx` | read `date/start/studio/location_id/teacher` query-param prefill; render conflict warning + "Save anyway" (§4, §5) |
| `app/(admin)/admin/privates/actions.ts` | add conflict-check helper over both sources (§5); no schedule_instances write |

No DDL. No migration. (If any column is missing for the mapping, that is a
finding to raise before writing code, not a silent `apply_migration`.)

---

## 8. Acceptance criteria

1. A one-off private created from the form appears on `/admin/schedule` in the
   correct room/day/time, purple, labeled "Private Reservation — [Teacher]".
2. Clicking an empty Studio 2 cell at 4:00 PM Monday opens New Private with
   date = that Monday, start = 4:00 PM, studio = Studio 2 pre-filled.
3. Saving a private that overlaps an existing class or private in the same room
   or with the same teacher shows a warning naming the clash and a "Save anyway"
   confirm; confirming saves; the private then shows on the calendar.
4. A student flagged privates-non-visible still renders as "Private Reservation"
   — no student name leaks to the calendar.
5. The location filter narrows privates by `location_id`.
6. `npx tsc --noEmit` clean.

---

## 9. Open risks / to verify during build

- **Recurring private expansion** (§3.2) — confirm the week-expansion helper can
  take a `recurrence_rule` from `private_sessions`, or scope to one-off first.
- **Free-text `studio` with no `room_id`/`location_id`** — placement + location
  filter behavior (§3.1, §3.3). Real data has privates with only `studio`.
- **Timezone** at slot-click (§4) — tenant tz, not browser.
- **Privacy flag source** — confirm the exact column/rule that marks a student's
  privates non-visible (COMMUNICATIONS_HUB.md) before wiring D6.

---

## 10. Build order (each its own step; terminal named per commit)

1. Read path (§3) — privates show on the calendar (one-off first).
2. Slot-click prefill (§4).
3. Conflict warn-but-allow (§5).
4. Recurrence expansion (§3.2) if not folded into step 1.
5. Verify (§8) incl. a browser test screenshot.

_Also owed: add this file to `docs/_INDEX.md` (it is 25+ specs behind — SESSION_PICKUP.md §6)._
