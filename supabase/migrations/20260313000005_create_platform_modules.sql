-- Platform Module Control System
-- Replaces simple feature_flags with a richer module system

CREATE TABLE IF NOT EXISTS platform_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  label         text NOT NULL,
  description   text,
  nav_group     text NOT NULL,
  icon          text NOT NULL DEFAULT '◇',
  href          text,
  sort_order    integer NOT NULL DEFAULT 0,
  platform_enabled  boolean NOT NULL DEFAULT true,
  tenant_enabled    boolean NOT NULL DEFAULT true,
  nav_visible       boolean NOT NULL DEFAULT true,
  requires_role     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_modules_group ON platform_modules(nav_group);

ALTER TABLE platform_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read modules"
  ON platform_modules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin can manage modules"
  ON platform_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Seed all modules
-- STUDIO group
INSERT INTO platform_modules (key, label, description, nav_group, icon, href, sort_order, platform_enabled, tenant_enabled, nav_visible) VALUES
  ('dashboard',          'Dashboard',         'Studio overview and key metrics',                    'Studio',               '⌂', '/admin/dashboard',          10, true, true, true),
  ('seasons',            'Seasons',           'Academic year and season management',                'Studio',               '◈', '/admin/seasons',            20, true, false, true),
  ('schedule',           'Schedule',          'Master class and event schedule',                    'Studio',               '▥', '/admin/schedule',           30, true, true, true),
  ('classes',            'Classes',           'Class management and rosters',                       'Studio',               '▦', '/admin/classes',            40, true, true, true),

-- STUDENTS & FAMILIES group
  ('students',           'Students',          'Student profiles and enrollment',                    'Students & Families',  '♡', '/admin/students',           10, true, true, true),
  ('families',           'Families',          'Family accounts and contacts',                       'Students & Families',  '◇', '/admin/families',           20, true, true, true),

-- STAFF group
  ('teachers',           'Teachers',          'Teacher profiles and pay rates',                     'Staff',                '★', '/admin/teachers',           10, true, true, true),
  ('timesheets',         'Timesheets',        'Teacher hour logging and payroll',                   'Staff',                '▤', '/admin/timesheets',         20, true, true, true),
  ('substitutes',        'Substitutes',       'Substitute teacher requests and coverage',           'Staff',                '↻', '/admin/substitute-requests',30, true, false, true),
  ('compliance',         'Compliance',        'Document tracking, W-9s, background checks',        'Staff',                '◆', '/admin/compliance',         40, true, false, true),

-- PRODUCTIONS group
  ('productions',        'Productions',       'Production planning and management',                 'Productions',          '♛', '/admin/productions',        10, true, false, true),
  ('rehearsals',         'Rehearsals',        'Rehearsal scheduling and attendance',                'Productions',          '♪', '/admin/rehearsals',         20, true, true, true),
  ('ticketing',          'Ticketing',         'Performance tickets, seating, and sales',            'Productions',          '◫', '/admin/ticketing',          30, true, false, true),
  ('programs',           'Programs',          'Sub-brand program management',                       'Productions',          '◈', '/admin/programs',           40, true, false, true),

-- COMMUNICATIONS group
  ('announcements',      'Announcements',     'Studio-wide announcements and notifications',        'Communications',       '✉', '/admin/communications',     10, true, false, true),
  ('email_templates',    'Email Templates',   'Branded email template builder',                     'Communications',       '✧', '/admin/emails',             20, true, false, true),
  ('angelina',           'Angelina AI',       'AI assistant chat and knowledge base',               'Communications',       '◈', '/admin/chat',               30, true, false, true),

-- SETTINGS group
  ('settings_my',        'My Settings',       'Personal profile and preferences',                   'Settings',             '◎', '/admin/settings',           10, true, true, true),
  ('settings_studio',    'Studio Settings',   'Studio profile, hours, integrations',                'Settings',             '◑', '/admin/settings/studio',    20, true, true, true),
  ('settings_platform',  'Platform',          'Module control, feature flags, tenants',             'Settings',             '◉', '/admin/settings/platform',  30, true, true, true)
ON CONFLICT (key) DO NOTHING;
