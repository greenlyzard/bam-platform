# Class Meetings (A-full) — Per-Day Scheduling Model

**Status:** Draft spec — awaiting approval
**Last updated:** 2026-07-10
**Scope:** new `class_meetings` table; `classes` (deprecate scalar day/time, add commitment toggle); all class schedule readers (enrollment catalog, enrollment chat, admin builder, teacher schedule, calendar, closures display); occurrence generator (task 19) design note
**Related:** `_INDEX.md` task 19 (occurrence generator will consume `class_meetings`); `docs/LOCATIONS_AND_FACILITIES.md` (per-meeting `room_id`); future `BILLING_ENGINE.md` (per-day vs. bundled pricing depends on the commitment toggle)

---

## 1. Purpose

Today a class stores a single `day_of_week` + `start_time` + `end_time`, with a redundant `days_of_week[]` array the admin can write but every reader ignores (a latent split-brain). Twice-weekly classes are modeled as duplicate rows, so a parent sees two identical cards and could enroll in one day thinking they got the class.

This spec establishes the correct model — a `class_meetings` child table where one class has N meetings, each with its own day, time, and room. It supports single-day classes, same-time twice-weekly, and **different-time-per-day** classes. It also adds a per-class **commitment toggle** (all-days vs. single-day-allowed) that a later billing engine will use for pricing.

**This is the highest-risk structural change to date** — it moves scheduling data out of the most-read table in the platform. Build staged, verify each surface, never one giant commit. Do it now, before RSM data and real families land ("nobody's using it yet" = lowest cost).

**Boundary:** structure + display only. Per-day *enrollment records* and per-day *pricing* are DEFERRED to the billing engine — this spec stores the commitment toggle and displays meeting days; it does not wire the toggle to money or split enrollments by day.

---

## 2. Current reality (from investigation)

- `classes`: `day_of_week` (int, scalar), `days_of_week` (int[]), `start_time`, `end_time` — both day columns populated; every `days_of_week` array is single-element. No child schedule table.
- Model today = "same time on N days" via the array — but no reader honors it.
- 63 live classes; 3 are twice-weekly modeled as duplicate rows (Intermediate Ballet Mon+Wed, Advanced Ballet Tue+Thu, Princess Petites Mon+Thu).
- Admin builder writes `days_of_week[]` + sets `day_of_week = days_of_week[0]`. All readers key off the scalar `day_of_week` → multi-day silently under-displays.
- Per-occurrence scheduling lives in `schedule_instances` (frozen, task 19).

---

## 3. Data model

### class_meetings (new)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `class_id` | uuid → `classes.id` (CASCADE) | |
| `day_of_week` | int (0=Sun…6=Sat) | one meeting = one day |
| `start_time` | time | per-meeting (supports different times per day) |
| `end_time` | time | per-meeting |
| `room_id` | uuid → `rooms.id`, nullable | per-meeting room (a class can be Studio 1 Mon, Studio 2 Wed) |
| `sort_order` | int | display order |
| timestamps | | |

One class → N meetings. This subsumes single-day (1 meeting), same-time twice-weekly (2 meetings, same times), and different-time-per-day (2 meetings, different times).

### classes (modified)
- Add `allow_single_day boolean NOT NULL DEFAULT false` — the **commitment toggle**. `false` = enroll in the whole class (all meetings); `true` = single-day enrollment permitted. **Stored + displayed now; drives pricing later (billing engine).**
- **Deprecate** `day_of_week`, `days_of_week`, `start_time`, `end_time` on `classes` — data moves to `class_meetings`. Keep the columns through the migration for a safe transition, then remove once all readers are repointed (staged — see §6).
- Per-meeting `room_id` supersedes `classes.room_id` for scheduling; confirm how `classes.room_id` is used before removing (it feeds the current room dropdown).

---

## 4. Migration of existing data

- For each of the 63 classes: create `class_meetings` rows from its current `day_of_week`/`days_of_week` + `start_time`/`end_time` + `room_id`.
- **Collapse the 3 twice-weekly duplicate-row classes** into one class each with two `class_meetings` rows. This is a data-consolidation step — identify by identical name + times across two rows, merge to one class, preserve enrollments. Do carefully with a pre-flight that lists exactly the rows to merge and RAISES if the shape is unexpected.
- Pre-flight guard: assert every class ends with ≥1 meeting; RAISE on any class that would end with zero.
- All via `supabase db push`; verify with bam-schema-sync.

---

## 5. Reader sweep (each verified before the next)

Every surface that reads class day/time must switch from the `classes` scalar to `class_meetings`, rendering ALL meetings ("Mon & Wed 4:30 PM", or per-day times when they differ):

- Enrollment catalog (`lib/queries/enroll.ts` `getClassCatalog`)
- Enrollment chat (`components/assistant/enrollment-chat.tsx` + `class-recommendation-card.tsx`)
- Admin class builder (`class-edit-drawer.tsx`) — edit N meetings with per-meeting day/time/room; set `allow_single_day` toggle
- Admin class list / calendar display
- Teacher schedule (`teach/schedule`)
- Calendar / ICS
- Closures display (grey/badge by meeting day)
- Reuse `lib/format/schedule.ts` for formatting.

---

## 6. Build sequence (staged — never one commit)

1. **Schema + migrate:** create `class_meetings`, add `allow_single_day`, migrate the 63 classes, collapse the 3 duplicates. `db push` + type regen. Verify row counts and that every class has ≥1 meeting.
2. **Admin builder:** edit per-meeting day/time/room + the commitment toggle; write to `class_meetings`. Verify a class can be saved with 2 meetings at different times/rooms.
3. **Readers, one surface at a time:** enrollment catalog → enrollment chat → teacher schedule → calendar/ICS → closures display. After each, verify the 63 classes (esp. the 3 now-merged twice-weekly) display all meetings correctly.
4. **Retire the deprecated `classes` scalar day/time columns** once no reader references them. Final migration.

Do NOT load RSM classes until at least steps 1–2 land — enter them on the correct model once.

---

## 7. Boundaries / deferred

- **Per-day enrollment + pricing:** DEFERRED to the billing engine. This spec stores `allow_single_day` and displays meetings; it does not create per-meeting enrollment records or per-day charges.
- **Occurrence generator (task 19):** will consume `class_meetings` (per-meeting day/time/room is exactly what it needs to materialize `schedule_instances`). Design `class_meetings` with this in mind; the generator build itself stays task 19.
- **Billing engine:** the commitment toggle's pricing meaning, bundles, and discounts are a separate spec (`BILLING_ENGINE.md`), gated on the payment reality map.
