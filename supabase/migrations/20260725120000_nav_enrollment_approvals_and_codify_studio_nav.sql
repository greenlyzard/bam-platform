-- Nav maintenance for platform_modules — data only, no DDL, no schema shape change.
--
-- 1. Adds the Enrollment Approvals nav row.
-- 2. Codifies two changes that exist in production but in no migration.
-- 3. Breaks a sort_order tie in the Students & Families group.
--
-- No updated_at writes: platform_modules has no updated_at trigger, and existing
-- nav migrations (20260313000010, 20260317205007, 20260318221239) do not set it.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enrollment Approvals → /admin/enrollment/approvals
--    Route: app/(admin)/admin/enrollment/approvals/page.tsx (requireAdmin).
--    sort_order 27 places it after Enrollment Pipeline (25) and Evaluations (26),
--    before Enrollments (30).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO platform_modules (key, label, description, nav_group, icon, href, sort_order, platform_enabled, tenant_enabled, nav_visible)
VALUES ('enrollment_approvals', 'Approvals', 'Review and approve pending enrollment requests', 'Students & Families', '✓', '/admin/enrollment/approvals', 27, true, true, true)
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Codify untracked production state.
--
--    Both rows were seeded by 20260313000005_create_platform_modules.sql and have
--    never been touched by a migration since. The values below were applied by hand
--    in the Supabase SQL editor alongside their corresponding code commits, so a
--    rebuild from migrations alone would silently restore the pre-March behavior.
-- ─────────────────────────────────────────────────────────────────────────────

-- Seeded as '/admin/schedule'. Repointed by hand to match commit f629df2
-- ("fix: Schedule nav points to classes room calendar, redirect reversed"),
-- which also reversed the next.config.ts redirect to /admin/schedule → /admin/classes.
-- Pointing this back at /admin/schedule would only bounce users through that 308.
UPDATE platform_modules
SET href = '/admin/classes'
WHERE key = 'schedule';

-- Seeded as nav_visible = true. Hidden by hand to match commit 2d1ce6a
-- ("feat: redirect /admin/classes to /admin/schedule, Classes hidden from nav"),
-- which made this row a duplicate destination of the 'schedule' row above.
UPDATE platform_modules
SET nav_visible = false
WHERE key = 'classes';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Break the Students & Families sort_order tie.
--    enrollment_pipeline and evaluations were both 25. buildNavGroups()
--    (components/layouts/admin-nav.tsx:58) sorts on sort_order alone, and the
--    layout query orders by sort_order with no tiebreaker, so their rendered
--    order was not stable. enrollment_pipeline stays at 25.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE platform_modules
SET sort_order = 26
WHERE key = 'evaluations';
