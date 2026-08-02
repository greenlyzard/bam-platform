-- Regroup the admin sidebar into a Schedule group. Data only — no DDL.
--
-- The admin sidebar is not hardcoded: components/layouts/admin-nav.tsx renders
-- whatever app/(admin)/layout.tsx reads out of platform_modules. Grouping and
-- ordering therefore live here, in data. The one code-side dependency is the
-- GROUP_ORDER whitelist in admin-nav.tsx, which buildNavGroups() filters
-- against — a nav_group absent from that array renders nothing. This migration
-- ships alongside the GROUP_ORDER edit that adds 'Schedule' and drops 'Studio'
-- and 'Productions'.
--
-- Resulting sidebar:
--
--   Dashboard                        (standalone, above all groups)
--   SCHEDULE
--     Calendar      /admin/schedule
--     Classes       /admin/classes
--     Privates      /admin/privates
--     Rehearsals    /admin/rehearsals
--     Productions   /admin/productions
--     Seasons       /admin/seasons
--   STUDENTS & FAMILIES              (unchanged)
--   STAFF                            (loses Privates)
--   COMMUNICATIONS                   (unchanged)
--   SETTINGS                         (unchanged)
--
-- No performances row is created. /admin/performances exists but is a
-- "Coming soon" EmptyState stub, and it is deliberately absent from the
-- grouping above. Casting is likewise omitted — no such route exists.
--
-- No updated_at writes: platform_modules has no updated_at trigger, and no
-- prior nav migration sets it (see 20260725120000).


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Calendar → /admin/schedule
--
--    This row is repaired here, not merely moved. It was seeded pointing at
--    /admin/schedule, then repointed by hand to /admin/classes to implement the
--    merge proposed in docs/UNIFIED_SCHEDULE.md — a proposal REJECTED
--    2026-04-29, four weeks after the code shipped. 20260725120000 codified the
--    hand-edit rather than reverting it, on the correct reasoning at the time
--    that a next.config.ts redirect would have bounced /admin/schedule straight
--    back to /admin/classes anyway.
--
--    That redirect was removed 2026-07-30. /admin/schedule has been reachable
--    and unlinked from the nav ever since; this row is the last surviving piece
--    of the rejected merge. Pointing it back restores the April decision: the
--    two surfaces are separate on purpose — /admin/schedule is the operational
--    live view, /admin/classes is class management.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET label      = 'Calendar',
    href       = '/admin/schedule',
    nav_group  = 'Schedule',
    sort_order = 10
WHERE key = 'schedule';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Classes → visible again.
--
--    Hidden by hand (codified in 20260725120000) only because the row above had
--    been repointed at /admin/classes, making this one a duplicate destination.
--    With Calendar back on /admin/schedule that collision is gone and Classes
--    is a distinct surface again, so it returns to the nav.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET nav_group   = 'Schedule',
    sort_order  = 20,
    nav_visible = true
WHERE key = 'classes';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Privates: Staff → Schedule.
--    A private lesson is a scheduled event, not a staff-admin surface.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET nav_group  = 'Schedule',
    sort_order = 30
WHERE key = 'privates';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rehearsals and Productions: Productions → Schedule.
--    Ordered the way the work actually runs — rehearsals lead to a production.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET nav_group  = 'Schedule',
    sort_order = 40
WHERE key = 'rehearsals';

UPDATE platform_modules
SET nav_group  = 'Schedule',
    sort_order = 50
WHERE key = 'productions';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Seasons: Studio → Schedule, last in the group.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET nav_group  = 'Schedule',
    sort_order = 60
WHERE key = 'seasons';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Dissolve the Studio group.
--
--    Dashboard is the only row left in it, and it is now rendered standalone
--    above the groups (special-cased by key in admin-nav.tsx, so this value no
--    longer drives sidebar placement). It is moved to its own nav_group rather
--    than left on 'Studio' so that no row anywhere still claims a group that
--    has been dissolved — 'Studio' would otherwise survive as a heading in the
--    module control grid at /admin/settings/platform/modules, which groups by
--    this column and has its own, separate ordering list.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET nav_group = 'Dashboard'
WHERE key = 'dashboard';


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Hide Ticketing and Programs.
--
--    Both are nav_visible = true today and both 404: no app/(admin)/admin/
--    ticketing or /programs route exists. Rows are kept, not deleted — the
--    modules are planned (M11 Performance Events & Ticketing).
--
--    NOTE for whoever builds them: these rows keep nav_group = 'Productions',
--    and that group is being removed from GROUP_ORDER in admin-nav.tsx by this
--    change. Flipping nav_visible back to true is therefore NOT sufficient to
--    make them appear — they will need a nav_group that GROUP_ORDER contains.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET nav_visible = false
WHERE key IN ('ticketing', 'programs');
