-- Studio levels (replaces the studio_settings.custom_colors.level_list approach)
CREATE TABLE IF NOT EXISTS studio_levels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  description text,
  parent_id   uuid REFERENCES studio_levels(id) ON DELETE SET NULL,
  age_min     integer,
  age_max     integer,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  color_hex   text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS studio_programs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  name              text NOT NULL,
  description       text,
  color_hex         text,
  requires_audition boolean NOT NULL DEFAULT false,
  has_contract      boolean NOT NULL DEFAULT false,
  sort_order        integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS program_eligible_levels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES studio_programs(id) ON DELETE CASCADE,
  level_id   uuid NOT NULL REFERENCES studio_levels(id) ON DELETE CASCADE,
  UNIQUE(program_id, level_id)
);

CREATE TABLE IF NOT EXISTS student_programs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id),
  program_id uuid NOT NULL REFERENCES studio_programs(id),
  season_id  uuid REFERENCES seasons(id),
  status     text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','audition_pending','withdrawn')),
  joined_at  date,
  left_at    date,
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, program_id, season_id)
);

ALTER TABLE studio_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_eligible_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_levels ON studio_levels;
CREATE POLICY admin_all_levels ON studio_levels FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS admin_all_programs ON studio_programs;
CREATE POLICY admin_all_programs ON studio_programs FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS admin_all_program_levels ON program_eligible_levels;
CREATE POLICY admin_all_program_levels ON program_eligible_levels FOR ALL TO authenticated USING (is_admin());

DROP POLICY IF EXISTS admin_all_student_programs ON student_programs;
CREATE POLICY admin_all_student_programs ON student_programs FOR ALL TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_studio_levels_tenant ON studio_levels(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_studio_levels_parent ON studio_levels(parent_id);
CREATE INDEX IF NOT EXISTS idx_studio_programs_tenant ON studio_programs(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_student_programs_student ON student_programs(student_id);

-- Seed BAM levels — top-level parents
INSERT INTO studio_levels (tenant_id, name, sort_order, is_active) VALUES
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Petites', 1, true),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Level 1', 2, true),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Level 2', 3, true),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Level 3', 4, true),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Level 4', 5, true),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Adult', 6, true),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Teen', 7, true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Sub-levels referencing parents
INSERT INTO studio_levels (tenant_id, name, parent_id, sort_order, is_active)
SELECT
  '84d98f72-c82f-414f-8b17-172b802f6993',
  sub.name,
  p.id,
  sub.sort_order,
  true
FROM (VALUES
  ('Level 2', 'Level 2A', 1),
  ('Level 2', 'Level 2B+', 2),
  ('Level 2', 'Level 2C', 3),
  ('Level 2', 'Level 2C+', 4),
  ('Level 3', 'Level 3A', 1),
  ('Level 3', 'Level 3B', 2),
  ('Level 3', 'Level 3C', 3),
  ('Level 4', 'Level 4A', 1),
  ('Level 4', 'Level 4B', 2),
  ('Level 4', 'Level 4C', 3),
  ('Adult', 'Adult/Teen', 1)
) AS sub(parent_name, name, sort_order)
JOIN studio_levels p ON p.name = sub.parent_name
  AND p.tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
ON CONFLICT (tenant_id, name) DO NOTHING;
