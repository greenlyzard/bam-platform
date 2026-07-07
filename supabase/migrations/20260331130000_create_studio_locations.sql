-- Capture studio_locations into version control.
-- This table already exists in the live DB (created out-of-band, not via a tracked
-- migration) and is referenced by 20260331140000_location_hours.sql (FK target) and
-- by rooms.location_id. Without this file, a clean rebuild fails when location_hours
-- references a table that was never created.
--
-- Timestamped immediately before location_hours so a fresh rebuild creates it in
-- dependency order. Idempotent (IF NOT EXISTS) so it is a no-op against live.
-- Mirrors live exactly: columns, defaults, PK, tenant FK (ON DELETE CASCADE), RLS,
-- and both policies. No updated_at trigger (matches sibling table location_hours).

CREATE TABLE IF NOT EXISTS public.studio_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  address     text,
  city        text,
  state       text,
  zip         text,
  is_primary  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage studio_locations" ON public.studio_locations;
CREATE POLICY "Admins can manage studio_locations"
  ON public.studio_locations
  FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can view active locations" ON public.studio_locations;
CREATE POLICY "Authenticated users can view active locations"
  ON public.studio_locations
  FOR SELECT
  USING (is_active = true);
