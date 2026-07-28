# Calendar & Public Events

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28

---

## 1. What this is for

One calendar surface, several sources, different audiences:

| Want | Example |
|---|---|
| A studio event families can see | Nutcracker auditions, Saturday |
| A performance the public can find | Spring show, Nutcracker run |
| A community event the studio wants on the calendar | Butterfly Festival, National Dance Day, ABT's Nutcracker |
| An internal celebration | Student birthdays |

None of this works today. The immediate trigger was a Nutcracker audition four days out with no way to enter it and no public surface to put it on.

---

## 2. The sorting rule

> **Does the event consume a room, a teacher, or payroll?**
> Yes → `schedule_instances`. No → `calendar_events`.

An audition consumes all three — a room, a teacher, hours that land on a timesheet. ABT's Nutcracker consumes none. Putting the latter in `schedule_instances` buys room-conflict checks against a venue the studio does not own, a row the occurrence generator must special-case, and eventually an auto-drafted timesheet entry (`PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.6) for a performance nobody at the studio worked.

Birthdays consume nothing and are not events at all — see §5.

---

## 3. Findings

### 3.1 No audition event type

`schedule_instances.event_type` allows eight values:

`class`, `trial_class`, `rehearsal`, `private_lesson`, `performance`, `room_block`, `teacher_absence`, `studio_closure`

An audition is none of them. Filing it as `rehearsal` or `performance` misreports it in every event view and corrupts the production-level P&L tagging the payroll work depends on (`production_id` / `competition_id` on `timesheet_entries`).

Likely additions: `audition`, `fitting`, `workshop`, `masterclass`, `photo_day`, `meeting`. Worth settling as a set rather than adding one at a time — each addition is a CHECK constraint migration.

### 3.2 No public visibility on the one table that holds events

`schedule_instances` has 27 columns and none of them is a visibility flag. `status` allows `draft`, `pending_approval`, `approved`, `published`, `cancelled`, `notified` — that is **workflow state, not audience**. A published class is not a public class.

Twenty other tables carry visibility columns — `productions.is_published`, `seasons.is_public`, `classes.show_capacity_public`, `class_field_config.public_visible` — so the concept exists everywhere except where events live.

### 3.3 Public and internal titles are not the same string

"Nutcracker Auditions — Ages 8+, Studio 1, 10am" is a public listing. The internal record is a room booking with a teacher assignment, an approval status, and notes that may reference specific students. **Reusing one title field guarantees internal wording reaches a public page eventually.** Separate `public_title` and `public_description`, defaulting to null and falling back to nothing — never falling back to the internal label.

### 3.4 `productions` overlaps, and cannot express a run

`productions` (21 columns) carries `performance_date`, `call_time`, `start_time`, `end_time`, `venue_name`, `venue_address`, `venue_directions`, and `is_published`. So a production is *itself* an event with a date — a fourth source.

**But `performance_date` is singular.** Nutcracker is multiple shows across a weekend, and this table can hold one date. Either performances become `schedule_instances` rows with `event_type = 'performance'` and `production_id` pointing at the production (currently **0 such rows exist**), or `productions` gains a child table of dates. The first is better: performances consume rooms and teachers, so they belong under the §2 rule anyway, and it makes the production the container rather than the event.

`productions` is currently **empty**, so this is a design decision rather than a migration problem.

### 3.5 Feed infrastructure exists, unused

`calendar_subscriptions` (`user_id`, `tenant_id`, `subscription_token`, `scope`, `provider`, `last_synced_at`) and `schedule_instances.ical_uid` both exist. Per-user tokenised iCal feeds with a scope were anticipated and never built. A public feed needs a tokenless variant — the whole point is that it requires no account.

---

## 4. Design

### 4.1 Studio events — extend `schedule_instances`

```
event_type          -- add: audition, fitting, workshop, masterclass,
                    --      photo_day, meeting
is_public           boolean not null default false
public_title        text null
public_description  text null
```

Public listing requires `is_public = true AND status = 'published'`. Two gates on purpose: a draft marked public must not leak, and a published internal class must not surface.

`public_title` null while `is_public` is true is a validation error, not a fallback to the internal title (§3.3).

### 4.2 Community events — a new table

Events the studio wants on its calendar that consume nothing:

```
calendar_events
  id, tenant_id
  category_id        -- FK, see below
  title              not null
  description        null
  starts_on          date not null
  ends_on            date null      -- null = single day
  start_time         time null      -- null = all-day
  end_time           time null
  location_name      text null      -- free text; not a room, often not the studio
  location_address   text null
  external_url       text null      -- tickets, festival site
  is_public          boolean not null default false
  status             text not null  -- draft | published | cancelled
  created_by, created_at, updated_at
```

Why not `schedule_instances`: multi-day (`ends_on`), all-day (`start_time` null), no room, no teacher, no payroll, and an external URL where the call to action is "go there", not "come here".

**Categories are data, not a CHECK.** BAM seeds Studio Event, Community Event, Professional Performance, Holiday, Closure. Another studio seeds its own. Same principle as `student_tiers` and `group_pricing_rules` in `PRIVATE_LESSON_BILLING_AND_CREDITS.md` §4.1 — no tenant's vocabulary belongs in a constraint.

```
calendar_event_categories
  id, tenant_id, key, label, color, sort_order, is_active
```

### 4.3 The public surface

One route, unioning:

- `schedule_instances` where `is_public AND status = 'published'`
- `calendar_events` where `is_public AND status = 'published'`

Rendered as month grid and as list, with an iCal export requiring no account. Cancelled events stay visible and struck through until they pass — a family who saw an event needs to learn it was cancelled, and silently removing it teaches people not to trust the calendar.

Public payloads carry `public_title`, `public_description`, date, time, and location only. Never teacher names, never room ids, never notes, never student references.

---

## 5. Birthdays — a view, not a table

`students.date_of_birth` is already populated (3 of 3 rows today; the real roster arrives at go-live from Studio Pro). Generating event rows would duplicate data and drift from it.

Query students with a birthday in the window and render. Nothing to maintain.

**Three rules:**

1. **Never public.** Minors' dates of birth. This does not touch the public feed under any circumstance, and must not inherit visibility from a shared calendar component — the failure mode is a component defaulting `is_public` true and a birthday appearing on a page anyone can load.
2. **Show the day, not the year.** "Ella turns 9 on Thursday" is what a teacher needs. A full DOB rendered on a wall-mounted or shared screen is exposure with no benefit.
3. **Scope like family contact data.** A teacher seeing birthdays for students in their own classes is reasonable. A studio-wide roster of children's birthdays is a different thing, and belongs behind `can_view_family_contact()` (`FAMILY_DATA_ACCESS.md` §3).

Worth confirming DOB completeness at import. A half-null column makes this feature half-empty on day one — a data problem, not a build problem.

---

## 6. Visibility matrix

| Source | Public | Parents | Teachers | Admin |
|---|---|---|---|---|
| `schedule_instances`, `is_public` | Yes | Yes | Yes | Yes |
| `schedule_instances`, internal | No | Own children's classes | Own assignments | All |
| `calendar_events`, `is_public` | Yes | Yes | Yes | Yes |
| `calendar_events`, internal | No | No | Yes | All |
| Birthdays | **Never** | Own children | Own students | All |

Enforced in RLS and in the query for the public route, not in the UI. The public route is unauthenticated, so anything it can reach is effectively published.

---

## 7. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Settle the event-type set (§3.1) and the `productions` vs `performance` decision (§3.4) | Decision |
| **2** | `event_type` CHECK expansion; `is_public`, `public_title`, `public_description` on `schedule_instances` | Low |
| **3** | Admin UI: mark an instance public, with the public title required when it is | Low |
| **4** | `calendar_event_categories` + `calendar_events`; seed BAM's categories | Low |
| **5** | Admin UI for community events | Low |
| **6** | Public calendar route: month + list, unioned, cancelled shown struck through | Medium |
| **7** | Public iCal feed, tokenless (§3.5) | Low |
| **8** | Internal birthday view (§5) | Low |
| **9** | Per-user tokenised feeds via `calendar_subscriptions` | Medium |

Phases 2–3 are what unblock an audition. Phase 6 is what makes it visible.

---

## 8. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **The event-type set** — audition, fitting, workshop, masterclass, photo day, meeting? Each addition is a CHECK migration, so settle the list once | Phase 1 |
| 2 | **Do performances live in `schedule_instances` or `productions`?** `productions.performance_date` is singular and cannot express a Nutcracker run | Phase 1 |
| 3 | **Who can mark an event public?** Publishing to an unauthenticated page is a different act from creating a class. Likely `super_admin` / `studio_manager`, not every admin | Phase 3 |
| 4 | **Does the public calendar need approval before publishing?** `approval_status` already exists on instances | Phase 3 |
| 5 | **Do parents see all public events, or public plus their own children's schedule merged?** Merged is more useful and more work | Phase 6 |

---

## 9. Multi-tenant notes

| BAM's version | Where it lives |
|---|---|
| Studio Event / Community Event / Professional Performance / Holiday | `calendar_event_categories` rows |
| Which roles may publish | Tenant setting, not a constant (§8 q3) |
| Public route path and branding | Per-tenant, alongside the existing white-label surfaces |

`event_type` is the exception: it stays a CHECK constraint because timesheet and payroll logic branches on it, and an arbitrary tenant-defined type would have no pay category to resolve against. If a tenant needs a type the studio model does not have, that is a `calendar_events` row.

---

## 10. Related

- `PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.6 — auto-drafted entries derive from `schedule_instances`; a new `event_type` needs a matching pay category or it drafts unpriced
- `FAMILY_DATA_ACCESS.md` — the visibility model §6 follows; birthdays are the sharpest case
- `PRIVATE_LESSON_BILLING_AND_CREDITS.md` §4.1 — categories-as-data precedent
- `_INDEX.md` task 19 — occurrence generator; public instances depend on generation reaching the date in question (currently 2026-11-25)
