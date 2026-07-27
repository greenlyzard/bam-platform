-- Tenant timezone — Phase A of docs/TENANT_TIMEZONE_SPEC.md §5
--
-- WHY THIS COLUMN EXISTS
-- Every server-side calendar date in this platform is currently derived in the
-- zone of the runtime that computed it. Vercel runs Node with no TZ set, so
-- that zone is UTC, and any date derived after ~5pm Pacific is already
-- tomorrow. A correct server-side calendar date is impossible without knowing
-- the STUDIO's zone, and as of 2026-07-26 no such column existed anywhere in
-- the schema — not on tenants, not on studio_settings, not on studio_locations
-- (verified against information_schema, and re-verified against pg_attribute
-- before writing this migration).
--
-- WHY THE DEFAULT IS PACIFIC
-- Ballet Academy and Movement is the only tenant today — public.tenants holds
-- exactly one row, and both its locations (San Clemente and Rancho Santa
-- Margarita) are America/Los_Angeles. The default exists so this column can be
-- NOT NULL without a separate backfill step, and so no application code path
-- has to handle a null zone.
--
-- IT IS NOT A SENSIBLE DEFAULT FOR ANY OTHER STUDIO. Tenant onboarding MUST
-- set this column explicitly. A second tenant that silently inherits the
-- default gets BAM's calendar: a New York studio would see every server-derived
-- date shift by three hours, a London studio by eight, with no symptom other
-- than wrong dates.
--
-- WHY tenants AND NOT studio_locations
-- Per spec §4.1: a tenant operating across multiple zones would need this
-- per-location. No tenant does today. The helper API in lib/dates.ts takes the
-- zone as a plain string parameter, so a per-location override is an additive
-- change later, not a refactor.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles';

-- Naming follows this schema's convention, verified against pg_constraint
-- before writing the DROP: every check constraint in public is the Postgres
-- default `<table>_<column>_check` (classes_status_check, charges_source_check,
-- badges_tier_check, …). DROP IF EXISTS first so this migration is re-runnable.
--
-- SCOPE OF THIS CHECK — measured against pg_timezone_names (1194 rows) on the
-- live database, not assumed:
--
--   accepts  'America/Los_Angeles', 'Europe/London', 'UTC', and 3-segment
--            names like 'America/Argentina/Buenos_Aires'
--   rejects  'PST', 'Pacific Time', 'UTC-8', ''  — the realistic onboarding
--            mistakes, and all fixed offsets, which do not observe DST
--
-- Two deliberate limitations:
--
--   1. It enforces SHAPE, not existence. A well-formed but fictional zone
--      ('Foo/Bar') still passes. A CHECK constraint cannot contain the
--      subquery against pg_timezone_names that would catch it; that needs a
--      BEFORE INSERT OR UPDATE trigger, out of scope for Phase A. The
--      application catches these anyway — Intl.DateTimeFormat throws
--      RangeError on an unknown zone, so a bad value fails loudly.
--
--   2. It rejects 70 of the 1194 names Postgres knows: the legacy
--      single-segment backward-compat aliases ('Japan', 'Iceland', 'GB',
--      'ROK', 'EET', 'HST', 'Navajo', 'W-SU', …). These are links to the
--      canonical Area/Location zones, and the canonical form is what belongs
--      in this column. A tenant in Reykjavik gets 'Atlantic/Reykjavik', not
--      'Iceland'. If that ever proves too strict, widen the regex — do not
--      drop the constraint.
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_timezone_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_timezone_check
  CHECK (
    timezone = 'UTC'
    OR timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){1,2}$'
  );

COMMENT ON COLUMN public.tenants.timezone IS
  'IANA timezone identifier for this studio (e.g. America/Los_Angeles, Europe/London). '
  'Authoritative source for every server-derived calendar date, pay period boundary, '
  'and date filter belonging to this tenant — the server runtime is UTC and must never '
  'be used. Defaults to Pacific because BAM is the only tenant; MUST be set explicitly '
  'at tenant onboarding. See docs/TENANT_TIMEZONE_SPEC.md.';
