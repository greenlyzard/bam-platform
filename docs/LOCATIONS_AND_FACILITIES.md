# Locations & Facilities

**Status:** Approved — canonical
**Last updated:** 2026-07-09
**Governs:** `studio_locations`, `rooms`, `location_hours`, `studio_closures`, `schedule_instances` (location fields), `classes.location_id` · admin/teacher/parent location surfaces
**Supersedes in `_INDEX.md`:** Pending task 11 (locations gap + rooms-vs-studio_resources reconciliation)

---

## 1. Purpose

The platform was built assuming a single studio. That assumption is now false: San Clemente is live, Rancho Santa Margarita (RSM) opens ~September 2026, and Ballet Academy and Movement regularly runs events and rehearsals at external venues (San Juan Hills High School theater, Casa Romantica, Pelican Hill). The database already carries a partial multi-location model, but no spec governs it, the admin model is forked, and the parent-facing side has no concept of location at all.

This spec defines the canonical location model, reconciles the fork, and specifies how every admin / teacher / parent surface must resolve and display location — so that (a) RSM can be built out dormant and launched cleanly, and (b) event/rehearsal venues appear on the calendars parents rely on, with correct addresses.

**Non-negotiable:** parents must never be sent to the wrong address. The calendar/ICS feed is the highest-stakes surface in this spec.

---

## 2. Canonical model (verdict from investigation)

**Canonical tables:** `studio_locations` + `rooms` (+ `location_hours`, `studio_closures`).

- `rooms` is the FK target for `classes.room_id`, `schedule_instances.room_id`, and `schedule_templates.room_id`. It backs the room dropdown and drives rentals/utilization.
- `classes.location_id` → `studio_locations.id` (currently display-only; no staff editor — see §6).

**Legacy / retire:** `studio_resources` + `studio_resource_assignments`.
- Only consumer is a per-class "Resources" multi-select that writes `studio_resource_assignments` — empty in production. Nothing schedules, bills, or reports against it.
- **Keep the `studio_resources` table dormant** (it is the only seed of a future equipment-booking concept referenced in `RESOURCE_INTELLIGENCE_SPEC.md`). Retire only its CRUD and the class-tag UI. Revisit for deletion if equipment booking is never built.

---

## 3. Location types

Add `studio_locations.location_type` (enum). Every location is exactly one type. Type — not `is_active` — governs parent-catalog eligibility, so a partner venue can be active year-round without ever leaking into the catalog.

| Type | Examples | Catalog / enrollment / parent filter | Schedulable (classes & instances) | On parent calendar / ICS |
|------|----------|:---:|:---:|:---:|
| `studio` | San Clemente, RSM | ✅ | ✅ | ✅ |
| `partner_venue` | San Juan Hills HS, Casa Romantica, Pelican Hill | ❌ | ✅ | ✅ |
| `internal` | Storage facility | ❌ | ❌ | ❌ |

- `studio` — teaching locations you operate. The only type eligible for the parent catalog, enrollment, and the parent-facing location filter.
- `partner_venue` — external venues used for events/rehearsals. Never a home studio and never catalog-eligible, but fully schedulable and **always** rendered on staff/parent calendars with their real address.
- `internal` — non-teaching support sites (storage, office). Exist for admin/inventory (e.g. future costume system); excluded from all scheduling and calendar surfaces.

**Default:** `studio`. Backfill San Clemente and RSM as `studio`.

---

## 4. Two-layer location resolution

Location resolves at two layers so a single session can move without disturbing enrollment.

- **Class default** — `classes.location_id`. The home studio. Enrollment and the parent catalog key off this. Must always be a `studio`.
- **Instance override** — `schedule_instances.location_id` (nullable) + optional external-venue fields. The actual location of one occurrence.

New fields on `schedule_instances`:
- `location_id` uuid, nullable → `studio_locations.id`
- `venue_name` text, nullable
- `venue_address` text, nullable

**Resolution order (single source of truth — implement once, reuse everywhere):**

```
resolveInstanceLocation(instance, class):
  if instance.venue_name is set        -> EXTERNAL one-off (venue_name + venue_address)
  else if instance.location_id is set  -> that studio_location (studio or partner_venue)
  else                                 -> inherit class.location_id (the home studio)
```

- NULL `location_id` + no `venue_name` = "inherit from class." This lets a class-level location change propagate automatically to every un-moved instance.
- Recurring venues (San Juan Hills, Casa Romantica, Pelican Hill) are real `partner_venue` locations with their own `rooms` — selected via `location_id`, **not** free text. Set them up once, reuse every season.
- `venue_name`/`venue_address` free text is reserved for the genuine one-off you will never reuse. It is the rare exception, not the mechanism.

---

## 5. Reconciliation (Build Step 1 — ship first, standalone)

This is a data-integrity fix independent of every new feature and de-risks everything after it. Ship it on its own.

1. **Collapse to one location CRUD.** Make `app/(admin)/admin/settings/studio/actions.ts` the sole writer of `studio_locations`. Strip `createLocation` / `updateLocation` / `toggleLocationActive` from `app/(admin)/admin/resources/manage/actions.ts`. This kills the duplicate write and, critically, the **two independent "clear the primary flag" paths** that can race into zero-or-two primaries.
2. **Enforce one primary per tenant.** Add a guarantee (partial unique index or trigger) that exactly one `is_primary = true` location exists per tenant, so the bug cannot recur regardless of code path.
3. **Retire the dead room model.** Remove the "Resources" multi-select in `class-edit-drawer.tsx` (writes to the empty `studio_resource_assignments`). Leave `studio_resources` / `studio_resource_assignments` tables in place, dormant.
4. **Clean orphan rooms.** Delete the 3 orphan `rooms` rows (`location_id = NULL`, `is_active = false`) — redundant legacy seed, superseded by the assigned active rooms.

No new location features land until Step 1 is merged.

---

## 6. Surface-by-surface requirements

All surfaces that render an occurrence's location must call the §4 resolver. Enrollment and catalog use the **class default**; anything tied to the actual event uses the **resolved instance**.

### Admin
- **Class builder / scheduler** — add a location + room field (currently missing). Sets `classes.location_id` (must be a `studio`) and `classes.room_id`. Room dropdown filtered to the chosen location's rooms.
- **Instance override UI** — in the schedule, allow moving a single instance: pick another `studio`/`partner_venue` location + room, or enter a one-off external venue. Clearly marks the instance as relocated.
- **Class list filter** — filter/group by location.
- **Attendance** — attendance records reference the resolved instance location (where it actually happened).
- **Timesheets / payroll** — hours reference the resolved instance location. Per-location cost reporting is a goal (Amanda will want per-site payroll/revenue). *Open item — confirm whether payroll must attribute per location in v1 or is report-only (§9).*
- **Enrollment / roster views** — show the class's home location.
- **Resource & room management** — single CRUD (post-reconciliation), rooms scoped to their location.
- **Reports / exports** — revenue and headcount per location. High value at launch.
- **Hours & closures** — already per-location in schema; surface per-location in admin.

### Teacher
- **My classes / my schedule** — show the resolved location + room per session, so a teacher covering both studios (or a venue) knows which building to attend.
- **Attendance-taking** — carries resolved instance location.
- **Substitute flows** — resolved location visible to subs.
- **My timesheet** — hours tagged with resolved location.

### Parent
- **Class catalog / browse** — display each class's home studio; add a **location filter/toggle** (`studio`-type only) so San Clemente and RSM are distinguishable. This is the original gap.
- **Public enrollment widget** — same location label + filter.
- **Enrollment / checkout** — show the class's home studio; no behavioral change to enrollment itself (location is class-level).
- **Schedule / portal calendar** — render resolved instance location per session.
- **Calendar / ICS feed — HIGHEST STAKES.** Must render the *resolved* instance location and **real address** (replace the hardcoded studio name currently in the ICS). When an instance's resolved location differs from the class default, visibly flag "location changed" so a parent never drives to the wrong place for a relocated rehearsal or performance.

---

## 7. Launch gating (RSM → September)

- RSM exists now as a dormant `studio` (`is_active = true`, 0 classes). It is invisible to parents today only because the parent side ignores location and RSM has no classes — this spec makes that intentional, not accidental.
- **Class visibility is gated by the class's own flags** (`is_active` / `is_hidden` / `is_rehearsal` / `is_performance` / status) — *not* by location. Therefore: **RSM classes must stay in a non-public status until the parent location filter (§6) ships.** A published RSM class before then would drop into the shared catalog with no way for parents to tell the studios apart.
- September launch = the point RSM classes are published, *after* the parent filter is live.
- Staff may build out RSM's full class schedule any time as drafts — safe, zero leak risk.

---

## 8. Migration & cleanup

- Add `location_type` to `studio_locations`; backfill San Clemente + RSM = `studio`.
- Add `location_id` / `venue_name` / `venue_address` to `schedule_instances`.
- Seed partner venues as `partner_venue` locations with their rooms: **San Juan Hills HS** (main theater + dance rooms), **Casa Romantica**, **Pelican Hill**. Seed the **storage facility** as `internal`.
- Reconcile existing **free-text venue strings** found in event/rehearsal fields: per string, decide whether it is a recurring venue (promote to a `partner_venue` location) or a true one-off (leave as instance free text).
- Backfill: all 63 existing classes already resolve to San Clemente — no class backfill needed.
- **All schema changes run via `supabase db push` in the Regular Terminal, then type regeneration. No `apply_migration`, no `execute_sql` writes** (per CLAUDE.md §5). Verify schema with the bam-schema-sync skill before writing any migration.

---

## 9. Open items / future

- **Partner/internal venue rows — DEFERRED to the staff-editor step (§10 step 4).** Do NOT seed San Juan Hills HS, Casa Romantica, or Pelican Hill (`partner_venue`), or the storage facility (`internal`) — not via migration and not now. Create them in the UI once the `location_type` selector ships, with real addresses Derek verifies before saving (the ICS feed will surface them to parents). Step 2 added only the schema; the enum values exist but no venue rows are seeded.
- **Studio-only class-home constraint — enforcement depth.** Enforced in UI + client `handleSave` only (no server action exists for class writes). DB-level enforcement (trigger, since it's a cross-table rule a CHECK can't express) is deferred hardening — acceptable for single-admin now, revisit before multi-admin or any non-UI class-write path.
- **Timesheet per-location attribution** — confirm whether v1 payroll attributes hours per location or per-location is report-only. Decide at the timesheet build step.
- **Per-location roles** — not in v1. Note any place a future "RSM site manager who only sees RSM" would need location in the RLS/permission layer, so we don't build into a corner. Flag-only.
- **Equipment booking** — dormant `studio_resources` is the seed. Out of scope here.
- **Costume inventory** — future system anchors on the `internal` storage location.

---

## 10. Build sequence (step by step)

1. **Reconciliation (§5)** — collapse CRUD, enforce single primary, retire dead room UI, clean orphan rooms. *Ship standalone first.*
2. **Schema migration (§8)** — `location_type`, instance override fields, seed partner/internal locations. Via `db push`.
3. **Location resolver (§4)** — single shared helper used by every surface.
4. **Staff-side assignment (§6 admin)** — location+room in class builder; instance override UI.
5. **Cross-persona reads (§6 admin/teacher)** — attendance, teacher schedule, reports resolve location.
6. **Parent-facing (§6 parent)** — catalog/widget label + filter; ICS/calendar resolved address + "location changed" flag.
7. **Launch (§7)** — publish RSM classes once the parent filter is live.

Each step is its own Claude Code build with Derek's review before commit.
