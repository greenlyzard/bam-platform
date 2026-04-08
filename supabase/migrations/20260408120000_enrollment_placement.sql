-- Enrollment placement & bundle configuration
-- Tables: season_placements, season_placement_releases,
--         enrollment_recommendations, bundle_configs
-- FK constraints intentionally omitted per CLAUDE.md migration rules
-- (no forward references — added in a later migration once all tables exist).

-- ============================================================
-- bundle_configs — studio-defined bundle/discount tiers
-- ============================================================

CREATE TABLE IF NOT EXISTS bundle_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  name            text NOT NULL,
  description     text,
  trigger_type    text NOT NULL
    CHECK (trigger_type IN ('class_count','hour_threshold','price_threshold','manual')),
  trigger_value   numeric,
  discount_type   text NOT NULL
    CHECK (discount_type IN ('flat_monthly','percentage','fixed_price','unlimited')),
  discount_value  numeric,
  is_unlimited    boolean DEFAULT false,
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_configs_tenant ON bundle_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bundle_configs_active ON bundle_configs(is_active);

-- ============================================================
-- season_placements — staged placements per student per season
-- ============================================================

CREATE TABLE IF NOT EXISTS season_placements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  season_id       uuid NOT NULL,
  student_id      uuid NOT NULL,
  class_id        uuid NOT NULL,
  placed_by       uuid,
  placement_type  text NOT NULL DEFAULT 'recommended'
    CHECK (placement_type IN ('recommended','required','optional')),
  placement_notes text,
  status          text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged','released','accepted','declined','modified','expired')),
  released_at     timestamptz,
  responded_at    timestamptz,
  response_notes  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(season_id, student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_season_placements_tenant ON season_placements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_season_placements_season ON season_placements(season_id);
CREATE INDEX IF NOT EXISTS idx_season_placements_student ON season_placements(student_id);
CREATE INDEX IF NOT EXISTS idx_season_placements_status ON season_placements(status);

-- ============================================================
-- season_placement_releases — release events per season
-- ============================================================

CREATE TABLE IF NOT EXISTS season_placement_releases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  season_id         uuid NOT NULL,
  released_by       uuid,
  scheduled_for     timestamptz,
  executed_at       timestamptz,
  families_notified integer DEFAULT 0,
  students_placed   integer DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_placement_releases_tenant ON season_placement_releases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_placement_releases_season ON season_placement_releases(season_id);

-- ============================================================
-- enrollment_recommendations — upsells & schedule-gap suggestions
-- ============================================================

CREATE TABLE IF NOT EXISTS enrollment_recommendations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  student_id          uuid NOT NULL,
  recommendation_type text NOT NULL
    CHECK (recommendation_type IN ('class','private','bundle_upsell','unlimited_upsell','schedule_gap')),
  class_id            uuid,
  bundle_config_id    uuid,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','snoozed')),
  snoozed_until       timestamptz,
  responded_at        timestamptz,
  responded_by        uuid,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enroll_recs_tenant ON enrollment_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enroll_recs_student ON enrollment_recommendations(student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_recs_status ON enrollment_recommendations(status);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
