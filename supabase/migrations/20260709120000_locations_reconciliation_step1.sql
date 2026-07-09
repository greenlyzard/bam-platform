-- Locations & Facilities — Reconciliation (Build Step 1)
-- Spec: docs/LOCATIONS_AND_FACILITIES.md §5
-- Scope: data-integrity only. No new features, no location_type, no schedule_instances fields.
-- Apply with: supabase db push (Regular Terminal). Do NOT apply via MCP.
--
-- This migration enforces at-most-one primary studio_location per tenant (spec §5.2),
-- fixing the double primary-flag-clear race now that a single CRUD (settings/studio)
-- writes studio_locations.
--
-- NOTE — spec §5.4 (delete 3 orphan rooms) is intentionally NOT performed.
-- Decision 2026-07-09: RETAIN the 3 orphan rooms (location_id IS NULL AND
-- is_active = false). Pre-flight showed they are FK-referenced by 61 historical
-- schedule_instances dated 2026-03-09..2026-03-14 (FK is ON DELETE SET NULL, so a
-- delete would silently null room_id on that history). They are kept intentionally;
-- no delete/repoint migration will be written.
--
-- The studio_resources / studio_resource_assignments TABLES are intentionally left in
-- place (dormant) per spec §5.3 — only their write UI is retired in code.

-- ─────────────────────────────────────────────────────────────────────────────
-- Exactly-one-primary-per-tenant
-- ─────────────────────────────────────────────────────────────────────────────
-- A partial unique index guarantees AT MOST one primary per tenant. Abort with a
-- clear message if the current data already has a tenant with two or more primaries
-- (the index creation would otherwise fail cryptically). "At least one" primary is
-- maintained by the application (the single studio-profile CRUD always keeps one);
-- it is not — and cannot be — enforced by this index.
DO $$
DECLARE
  bad_tenant uuid;
  primary_count int;
BEGIN
  SELECT tenant_id, count(*)
    INTO bad_tenant, primary_count
  FROM public.studio_locations
  WHERE is_primary = true
  GROUP BY tenant_id
  HAVING count(*) > 1
  LIMIT 1;

  IF bad_tenant IS NOT NULL THEN
    RAISE EXCEPTION
      'Tenant % has % primary studio_locations; expected at most 1. Resolve the duplicate primaries before applying this migration.',
      bad_tenant, primary_count;
  END IF;
END $$;

-- Enforce at-most-one primary location per tenant, going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_primary_location_per_tenant
  ON public.studio_locations (tenant_id)
  WHERE is_primary = true;
