# PRIVATE_ADD_FROM_CALENDAR.md
# Ballet Academy and Movement — Add a Private from the admin Calendar
# Status: Ready to build (spec-first, per §0 ritual)
# Created: 2026-08-04 | Owner: Derek Shaw
# Related (authoritative): PRIVATE_LESSONS.md (owns privates), COMMUNICATIONS_HUB.md (privacy naming)
# Related (context): PRIVATE_LESSON_BILLING_AND_CREDITS.md, TENANT_TIMEZONE_SPEC.md, STUDIO_CLOSURES.md
# Deprecated — do NOT build from: CALENDAR_AND_SCHEDULING.md, UNIFIED_SCHEDULE.md

---

## 1. Problem

An admin cannot add a private lesson from the Calendar.

> **§1 corrected 2026-08-04 during build (step 1).** The paragraphs below
> originally also claimed that a private "never appears on the Calendar at all"
> and that the `private_lesson` render branch was "currently unreachable — no
> such rows exist, and nothing produces them". **Both were wrong**, and the
> claim was labelled "verified" — it was not. `app/(admin)/admin/schedule/page.tsx`
> had unioned `private_sessions` into the feed since commit `ab7e56e` (the
> "alternative #2" seam in §3), so the purple branch was reachable and privates
> did render. What the spec got right is the *seam*: the union lived in the page,
> not the query layer. Step 1 was therefore a **relocate + fix**, not a build
> from zero — and the code it relocated was leaking student names (see §3.1).

Verified 2026-08-04 against the live code (not assumed — this is the exact spot
the pickup warns about):

- `lib/schedule/queries.ts::getScheduleInstances` read `schedule_instances`,
  `classes`, `productions`, `rooms`, etc. It did **not** read `private_sessions`.
  **Fixed in step 1** — it now fetches both sources and merges them.
- `app/(admin)/admin/privates/actions.ts::createPrivateSession` inserts into
  `private_sessions` (+ billing, notifications, credit_transactions). It does
  **not** write a `schedule_instances` row. Correct, and stays that way (D1).
- `schedule-calendar.tsx` renders `event_type === 'private_lesson'`
  (purple `#A855F7`, "Private" label), and free-text rooms already group into
  their own `name:` lane (`schedule-calendar.tsx:603-621`), so §3.1's unroomed
  requirement needed no calendar change.

The remaining gap is the **write** path: there is still no way to create a
private *from* the Calendar. That is steps 2–3, not step 1.

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
| room / column | `(location_id, lower(studio))` → `rooms` row | **Corrected 2026-08-04:** `private_sessions` has **no `room_id` column at all** (not "often no room_id"), and `location_id` alone cannot pick a room — it names a *location*. Resolution is the **pair**: the free-text `studio` matched to an active `rooms` row **at that location**. The pair is required because San Clemente and RSM each have a "Studio 1"; matching on name alone merges them. All 5 live privates resolve this way and sit in the existing Studio 1 (San Clemente) column. An unresolved private keeps its free-text name and lands in the calendar's own `name:` lane (or "Unassigned"), never dropped |
| teacher | `primary_teacher_id` (+ `co_teacher_ids`) | `co_teacher_ids` is honored by the **teacher filter** (a co-taught private shows when filtering to either teacher); the displayed teacher is the primary |
| title (display) | **"Private Reservation — [Teacher]"** | D6. Never student name on the calendar. **Unconditional** — not gated on `students.privates_visible_in_group`. That flag exists and governs the BAM PRIVATES *group feed*, where the default is student-name-visible; the calendar has no such default to opt out of (COMMUNICATIONS_HUB.md §6.2 + decision 2). **This fixed a live leak:** the pre-existing union rendered `` `Private: ${student first names}` `` |
| status filter | exclude `status IN ('cancelled','rescheduled')` | **"as classes do" was wrong** and is withdrawn: classes are *not* excluded — cancelled `schedule_instances` are returned and rendered struck-through, and there is no "show cancelled" filter to turn on. Privates are excluded per the explicit build instruction, matching the prior private behavior. `rescheduled` is excluded too: that row still carries the **old** date/time, so rendering it alongside its replacement double-books the studio. `completed` and `no_show` stay — those sessions happened. ⚠ Open: converge later by adding a real "show cancelled" toggle, or accept the class/private asymmetry |
| id | `private:{private_sessions.id}` | namespaced so click-through routes to the private, not a class. Currently consumed only as a React key — no click-through target exists yet |

### 3.2 Recurrence

`is_recurring` + `recurrence_rule` privates must be **expanded within the
requested week** the same way classes are, so a weekly private shows every week
— not only on its seed date. Reuse the existing occurrence/week expansion
approach; do not invent a second one. If expansion is non-trivial this phase,
ship one-off privates first and list recurring expansion as a follow-up (state
it in the PR, do not silently drop it).

**Step 1 shipped one-off only — recurrence is NOT expanded.** A recurring
private renders on its seed date and no other week. Stated here rather than
dropped silently, per the paragraph above. Currently invisible in practice:
0 of the 5 live rows have `is_recurring = true`. Still owed as a follow-up.

### 3.3 Location filter

**Corrected 2026-08-04:** there **is no location filter on `/admin/schedule`**.
The page's filters are Teacher / Level / Room / Day; the calendar states the
absence outright (`schedule-calendar.tsx:30-38` — "This page has no location
filter — every studio is in view at once"). So this section describes a filter
that does not exist and was a no-op for step 1.

What step 1 did instead, so the filter is cheap to add later: every private
carries `roomLocation`, resolved from its `location_id`. Room labels therefore
disambiguate the two "Studio 1"s the same way class labels do, and a future
SC / RSM / All control has the field it needs already populated.

When that filter is built: a private with only free-text `studio` and no
`location_id` appears under "All" and is flagged, not hidden. (Live data no
longer has any such row — all 5 privates carry `location_id`, contra the stale
claim in `STUDIO_CLOSURES.md` that location is free-text on all of them.)

---

## 4. Add-from-slot interaction (D3)

> **§4 corrected 2026-08-04 during build (step 2).** This section originally
> said "an empty region of a room/day column is clickable", as though such a cell
> already existed. **It did not.** Verified against `schedule-calendar.tsx`
> before writing any code:
>
> | View | Columns are | A click yields |
> |---|---|---|
> | Calendar (`week`) | the six **days**, each a vertical list of `SessionCard`s with no time axis | a **date** |
> | Room | **rooms**, each spanning the whole week | a **room** |
> | List | a table | nothing |
>
> No view had a room **and** a time axis, so no click could produce
> `{date, start_time, studio}` together, and **no view had a time axis at all** —
> `start_time` was not derivable anywhere. What §4 described was not a handler to
> attach; it was a grid to build.

**Decided with Derek 2026-08-04, and shipped:** add a **fourth view, "Day"
(rooms × time)**, to the existing view toggle. Two alternatives were rejected:
putting a time axis on the Calendar view's day columns (rewrites the view Amanda
uses daily, and a day column mixes all rooms so it still cannot name a studio),
and wiring two half-prefills — day column → date, Room column → studio — which
never fills date + time + studio from one click and leaves `start_time` empty.

### 4.1 The Day view, as built

- **Columns are active rooms**, labelled by `formatRoomLabel` exactly as
  elsewhere. Archived rooms are excluded for the same reason the Room filter
  excludes them (§6.1 of LOCATIONS_AND_FACILITIES.md): nothing is scheduled into
  one, and a click that books a private into a retired room is worse than no
  click. When the Room filter is set the grid narrows to that one room, keyed off
  the **URL** filter rather than the pending select, because the session data
  reflects the URL.
- **Rows are 30-minute slots**, spanning 8:00–21:00 by default, widened (never
  narrowed) to fit any session outside it.
- **Overlapping bookings stack into lanes** side by side, so two sessions in one
  room at one time cannot hide each other.
- **A trailing "No room" column** catches anything unresolved — an unroomed
  class, or a private whose free-text `studio` did not match a room at its
  `location_id` (§3.1). Its cells are deliberately **not clickable**: there is no
  room to prefill, and silently dropping the studio is a worse answer than no
  click. Nothing is hidden for want of a room, here as in §3.1.
- **A closed day reads identically to the Calendar view** — the closure banner
  and its "Show classes" toggle were extracted into one helper that both views
  call, so there is one rule and one piece of state, not two that can drift.
- **Day selection** is the six days already in view; it re-anchors on week
  navigation.
- The Calendar, List, and Room views are **unchanged**.

### 4.2 Prefill transport (as specified, and as built)

Query params on the existing route:
`/admin/privates/new?date=YYYY-MM-DD&start=HH:MM&studio=Studio%201&location_id=…`

`date` and `start` are **validated against `^\d{4}-\d{2}-\d{2}$` and
`^([01]\d|2[0-3]):[0-5]\d$` before use** — a query param is user input, and a
malformed one would seed a date/time input with a value it cannot represent. An
unparseable param is dropped, not corrected.

The route reads them and hands them to the **existing** form as initial state
(`initialDate` / `initialStartTime` / `initialStudio` / `initialLocationId`), all
optional — the teacher path passes none and is unchanged. No new form, no modal,
no second create path. A modal over the calendar stays acceptable later.

**`&teacher=` was NOT built.** The original text offered it "when a By-Teacher
column is clicked"; there is no by-teacher column in any view, so there is
nothing to derive it from. Teacher stays a form field.

End time defaults from the form's existing duration auto-calc (default 60 min).

If a clicked room's name is not one of the form's fixed `STUDIO_OPTIONS`, it is
appended as an option rather than leaving the select on a value matching none.

### 4.3 `location_id` had to become a persisted field

**Found during build:** `createPrivateSession` read `location_notes` and **never
read `location_id`**, so every private created through this form saved with
`location_id = NULL`. Without it the prefill is decorative — §3.1 resolves a
private to a room on the `(location_id, lower(studio))` **pair**, so a session
booked by clicking "Studio 1 · SC" would have come back on the calendar in a
free-text lane, not the column that was clicked.

The passthrough is now parsed once and written in **both** inserts — the primary
session and each recurring instance (a recurring private keeps its room). It
remains optional, so every existing caller that omits it behaves as before. This
is a write-path change and is therefore listed in §7.

### 4.4 Timezone

**No clock is read in the click path at all.** `date` is the selected column's
own date string and `start` is the slot's own label; neither is derived from
`new Date()`, so neither can be shifted across midnight by the browser's zone.

The one clock read is the new `today` prop, computed server-side in
`app/(admin)/admin/schedule/page.tsx` as `tenantToday(user.timezone)`
(TENANT_TIMEZONE_SPEC.md §4.2) and passed into the calendar. Note this changes
the **whole** calendar, not only the Day view: the "today" highlight and the
mobile expanded-day default now use the tenant zone instead of the browser's.
`/admin/privates/new` likewise defaults its date to `tenantToday(user.timezone)`
when no `date` param is present, in place of the form's browser-local
`todayStr()` fallback.

Still browser-local and **out of scope here**: `getThisWeekMonday()` behind the
"Today" button, and `getWeekRange()` in the page — both are
TENANT_TIMEZONE_SPEC.md Phase C.

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

**Corrected 2026-08-04 (step 2).** The original list was written before the Day
view existed and missed four files: `getRooms` had to return `location_id` (the
label type deliberately carries only `{name, abbreviation}`), the schedule page
had to supply the tenant-zone `today`, and the prefill has to be read by the
`new/` route and forwarded by its client wrapper — the form cannot read query
params itself, it takes props. Steps are marked so a reader can tell what has
landed from what step 3 still owes.

| File | Change | Step |
|---|---|---|
| `lib/schedule/queries.ts` | `getScheduleInstances`: also fetch + map `private_sessions` for the week (§3) | 1 ✅ |
| `lib/schedule/queries.ts` | `getRooms`: also return `location_id` — the Day view click needs the id, not the label (§4.1) | 2 ✅ |
| `app/(admin)/admin/schedule/schedule-calendar.tsx` | new **Day view** (rooms × time); empty-cell click → prefilled new-private (§4.1); shared closure banner; `today` prop | 2 ✅ |
| `app/(admin)/admin/schedule/page.tsx` | pass `today={tenantToday(user.timezone)}` (§4.4) | 2 ✅ |
| `app/(admin)/admin/privates/new/page.tsx` | read + **validate** `date/start/studio/location_id`; default date to tenant today (§4.2, §4.4) | 2 ✅ |
| `app/(admin)/admin/privates/new/new-private-client.tsx` | forward the prefill props to the form (§4.2) | 2 ✅ |
| `components/admin/private-session-form.tsx` | accept `initialDate/initialStartTime/initialStudio/initialLocationId` as initial state; submit `location_id` (§4.2, §4.3) | 2 ✅ |
| `components/admin/private-session-form.tsx` | render conflict warning + "Save anyway" (§5) | 3 |
| `app/(admin)/admin/privates/actions.ts` | persist `location_id` in both inserts (§4.3) | 2 ✅ |
| `app/(admin)/admin/privates/actions.ts` | add conflict-check helper over both sources (§5); no schedule_instances write | 3 |

No DDL. No migration — `private_sessions.location_id` already existed and was
simply never written. (If any column is missing for the mapping, that is a
finding to raise before writing code, not a silent `apply_migration`.)

Before building §5, read the form's existing **"Also booked in {studio}"** panel
(fed by `/api/admin/studio-availability`). It already surfaces same-studio
clashes on the selected date. Step 3 should extend or replace it, not add a
second overlapping warning.

---

## 8. Acceptance criteria

1. A one-off private created from the form appears on `/admin/schedule` in the
   correct room/day/time, purple, labeled "Private Reservation — [Teacher]".
2. **On the Day view** (§4.1 — the Calendar view has no room/time cell): with
   Monday selected, clicking the empty 4:00 PM cell in the Studio 2 column opens
   New Private with date = that Monday, start = 4:00 PM, studio = Studio 2, and
   the column's `location_id` pre-filled. Saving it returns it to that same
   column (§4.3) — the check is the round trip, not the form state.
3. Saving a private that overlaps an existing class or private in the same room
   or with the same teacher shows a warning naming the clash and a "Save anyway"
   confirm; confirming saves; the private then shows on the calendar.
4. A student flagged privates-non-visible still renders as "Private Reservation"
   — no student name leaks to the calendar.
5. ~~The location filter narrows privates by `location_id`.~~ **Withdrawn — not
   verifiable.** §3.3 established there is no location filter on
   `/admin/schedule`. Reinstate this criterion if and when one is built; until
   then it cannot pass or fail.
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

1. ✅ **Done 2026-08-04** — Read path (§3), one-off privates, union moved into
   `getScheduleInstances`. Also fixed the student-name leak (§3.1) and corrected
   §1 / §3.1 / §3.3 against the live code. Recurrence (§3.2) still outstanding.
2. ✅ **Done 2026-08-04** — Slot-click prefill (§4), via a new **Day view**
   (rooms × time) because no room/time cell existed to click. Also persisted
   `location_id` on create (§4.3) and moved the calendar's "today" onto the
   tenant timezone (§4.4). Corrected §4 / §7 / §8.2 against what shipped, and
   withdrew §8.5. Not verified in a browser yet — that is step 5.
3. Conflict warn-but-allow (§5).
4. Recurrence expansion (§3.2) if not folded into step 1.
5. Verify (§8) incl. a browser test screenshot.

_Also owed: add this file to `docs/_INDEX.md` (it is 25+ specs behind — SESSION_PICKUP.md §6)._
