-- ============================================================
-- STUDENT PROFILE TABLES MIGRATION
-- ============================================================

-- 1. Add tenant_id to existing badges table
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_badges_tenant ON public.badges(tenant_id);

-- 2. Add tenant_id to existing student_badges table
ALTER TABLE public.student_badges
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_student_badges_tenant ON public.student_badges(tenant_id);

-- 3. Create student_evaluations
CREATE TABLE IF NOT EXISTS public.student_evaluations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id          UUID        NOT NULL,
  evaluator_id        UUID,
  attributed_to_name  TEXT,
  evaluation_type     TEXT        NOT NULL CHECK (evaluation_type IN ('formal', 'progress_note', 'goal_setting', 'achievement_note')),
  title               TEXT,
  body                TEXT,
  skill_ratings       JSONB,
  is_private          BOOLEAN     NOT NULL DEFAULT false,
  season_id           UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_evaluations_tenant  ON public.student_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_student ON public.student_evaluations(student_id);

ALTER TABLE public.student_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage evaluations" ON public.student_evaluations;
CREATE POLICY "Admins can manage evaluations" ON public.student_evaluations
  FOR ALL USING (is_admin());

-- 4. Create student_profile_relatives (must come before share_permissions)
CREATE TABLE IF NOT EXISTS public.student_profile_relatives (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL,
  name          TEXT        NOT NULL,
  relationship  TEXT        NOT NULL,
  email         TEXT,
  share_token   TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  vanity_slug   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_profile_relatives_tenant  ON public.student_profile_relatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_profile_relatives_student ON public.student_profile_relatives(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_profile_relatives_token ON public.student_profile_relatives(share_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_profile_relatives_slug  ON public.student_profile_relatives(tenant_id, vanity_slug)
  WHERE vanity_slug IS NOT NULL;

ALTER TABLE public.student_profile_relatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage relatives" ON public.student_profile_relatives;
CREATE POLICY "Admins can manage relatives" ON public.student_profile_relatives
  FOR ALL USING (is_admin());

-- 5. Create student_profile_share_permissions
CREATE TABLE IF NOT EXISTS public.student_profile_share_permissions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  relative_id UUID    NOT NULL REFERENCES public.student_profile_relatives(id) ON DELETE CASCADE,
  section_key TEXT    NOT NULL CHECK (section_key IN ('bio', 'level', 'badges', 'photos', 'performances', 'highlight_reel', 'competitions', 'schedule')),
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (relative_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_share_permissions_tenant   ON public.student_profile_share_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_share_permissions_relative ON public.student_profile_share_permissions(relative_id);

ALTER TABLE public.student_profile_share_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage share permissions" ON public.student_profile_share_permissions;
CREATE POLICY "Admins can manage share permissions" ON public.student_profile_share_permissions
  FOR ALL USING (is_admin());

-- 6. Create student_google_photo_albums
CREATE TABLE IF NOT EXISTS public.student_google_photo_albums (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL,
  label       TEXT        NOT NULL,
  album_url   TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_google_photo_albums_tenant  ON public.student_google_photo_albums(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_google_photo_albums_student ON public.student_google_photo_albums(student_id);

ALTER TABLE public.student_google_photo_albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage photo albums" ON public.student_google_photo_albums;
CREATE POLICY "Admins can manage photo albums" ON public.student_google_photo_albums
  FOR ALL USING (is_admin());
