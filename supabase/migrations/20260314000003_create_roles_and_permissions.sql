-- ============================================================
-- Roles, Permissions, and Role-Permission mapping
-- Creates: roles, recreates role_permissions with FK to roles
-- Seeds: permissions registry, default roles, mappings
-- Does NOT touch profile_roles
-- ============================================================

-- ── ROLES TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Roles visible to tenant members
CREATE POLICY "tenant_members_read_roles" ON roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.tenant_id = roles.tenant_id
        AND pr.is_active = true
    )
  );

-- Admins can manage roles
CREATE POLICY "admins_manage_roles_table" ON roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );


-- ── PERMISSIONS TABLE ─────────────────────────────────────
-- Already created in 20260314000002; this is safe with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- RLS already enabled from previous migration; re-enable is safe
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_permissions' AND tablename = 'permissions') THEN
    CREATE POLICY "authenticated_read_permissions" ON permissions
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_manage_permissions' AND tablename = 'permissions') THEN
    CREATE POLICY "super_admin_manage_permissions" ON permissions
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END;
$$;


-- ── RECREATE ROLE_PERMISSIONS WITH FK TO ROLES ────────────
-- Drop old version (text-based role column) and recreate with UUID FK
DROP TABLE IF EXISTS role_permissions;

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL,
  permission_id UUID NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm_id ON role_permissions(permission_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_role_perms" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admins_manage_role_perms" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );


-- ── SEED PERMISSIONS ──────────────────────────────────────
-- Full registry from docs/ROLES_AND_PERMISSIONS.md Section 5

INSERT INTO permissions (key, label, description, category) VALUES
  -- Studio Management
  ('studio.settings.edit',        'Edit Studio Settings',       'Modify studio name, branding, hours',            'Studio Management'),
  ('studio.dashboard.view',       'View Studio Dashboard',      'Access admin dashboard and metrics',              'Studio Management'),
  ('studio.billing.manage',       'Manage Billing/Invoices',    'Create and manage invoices, payments',            'Studio Management'),
  ('studio.billing.view_own',     'View Own Invoices',          'View personal billing and invoices',              'Studio Management'),
  ('studio.staff.manage',         'Manage Staff Roles',         'Assign and modify staff roles',                   'Studio Management'),
  ('studio.staff.view',           'View Staff List',            'View list of staff members',                      'Studio Management'),

  -- Classes and Scheduling
  ('classes.manage',              'Create/Edit Classes',        'Create, edit, and delete classes',                'Classes'),
  ('classes.roster.view_all',     'View All Class Rosters',     'View rosters for any class',                      'Classes'),
  ('classes.roster.view_own',     'View Own Class Roster',      'View roster for assigned classes',                'Classes'),
  ('classes.attendance.take',     'Take Attendance',            'Mark attendance for classes',                      'Classes'),
  ('classes.schedule.view_own',   'View Own Schedule',          'View personal class schedule',                    'Classes'),

  -- Students and Families
  ('students.view_all',           'View All Student Profiles',  'Access any student profile',                      'Students'),
  ('students.view_own_class',     'View Own Class Students',    'View students in assigned classes',               'Students'),
  ('students.view_own_child',     'View Own Child Profile',     'View linked child profiles',                      'Students'),
  ('students.profile.edit_own',   'Edit Own Profile',           'Edit personal profile details',                   'Students'),
  ('students.profile.view_own',   'View Own Profile',           'View personal profile',                           'Students'),

  -- Productions and Ticketing
  ('productions.manage',          'Create/Edit Productions',    'Manage productions and casting',                  'Productions'),
  ('productions.comps.manage',    'Manage Comp Allocation',     'Allocate complimentary tickets',                  'Productions'),
  ('productions.scanner.activate','Activate Door Scanner',      'Enable scanning for events',                      'Productions'),
  ('productions.scanner.scan',    'Scan Tickets at Door',       'Scan and validate tickets',                       'Productions'),
  ('productions.push.send',       'Send Intermission Push',     'Send push notifications during events',           'Productions'),
  ('productions.tickets.purchase','Purchase Tickets',           'Buy tickets for events',                          'Productions'),
  ('productions.tickets.view_own','View Own Tickets',           'View personal ticket purchases',                  'Productions'),

  -- Communications
  ('comms.templates.edit_baseline','Edit Baseline Templates',   'Modify platform-level email templates',           'Communications'),
  ('comms.templates.edit_studio',  'Edit Studio Templates',     'Modify studio email templates',                   'Communications'),
  ('comms.announcements.send',    'Send Announcements',         'Send studio-wide announcements',                  'Communications'),
  ('comms.inbox.view',            'View Comms Inbox',            'Access communications inbox',                     'Communications'),
  ('comms.message.send',          'Send Message to Studio',      'Send messages to studio staff',                   'Communications'),

  -- Timesheets
  ('timesheets.manage',           'Manage All Timesheets',       'Approve, flag, adjust timesheets',                'Timesheets'),
  ('timesheets.own.manage',       'Manage Own Timesheet',        'Log hours, submit own timesheet',                 'Timesheets'),
  ('timesheets.payroll.view',     'View Payroll Reports',        'Access payroll report and export',                'Timesheets'),

  -- Portal Access
  ('admin.portal.access',         'Access Admin Portal',         'Log into the admin portal',                       'Portal Access'),
  ('teach.portal.access',         'Access Teacher Portal',       'Log into the teacher portal',                     'Portal Access'),
  ('parent.portal.access',        'Access Parent Portal',        'Log into the parent portal',                      'Portal Access'),

  -- Settings
  ('settings.platform.manage',    'Manage Platform Settings',    'Module control, feature flags, tenants',          'Settings')
ON CONFLICT (key) DO NOTHING;


-- ── SEED DEFAULT ROLES ────────────────────────────────────
DO $$
DECLARE
  v_tid UUID := '84d98f72-c82f-414f-8b17-172b802f6993';
  v_role_id UUID;
  v_perm_id UUID;
  v_perm_keys TEXT[];
  v_key TEXT;
BEGIN

  -- 1. super_admin (system role — full access)
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'super_admin', 'Full platform access including system settings', '#C45B5B', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'super_admin';
  -- super_admin gets ALL permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id FROM permissions p
  ON CONFLICT DO NOTHING;

  -- 2. admin
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'admin', 'Full operational access except platform settings', '#9C8BBF', false)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'admin';
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id FROM permissions p
  WHERE p.key NOT IN ('settings.platform.manage', 'comms.templates.edit_baseline')
  ON CONFLICT DO NOTHING;

  -- 3. finance_admin
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'finance_admin', 'Billing, invoicing, timesheets, and payroll', '#6B8FC4', false)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'finance_admin';
  v_perm_keys := ARRAY[
    'studio.dashboard.view', 'studio.billing.manage', 'studio.staff.view',
    'timesheets.manage', 'timesheets.payroll.view', 'admin.portal.access',
    'students.view_all', 'classes.roster.view_all'
  ];
  FOREACH v_key IN ARRAY v_perm_keys LOOP
    SELECT id INTO v_perm_id FROM permissions WHERE key = v_key;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- 4. teacher
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'teacher', 'Own classes, schedule, timesheets, student rosters', '#5A9E6F', false)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'teacher';
  v_perm_keys := ARRAY[
    'classes.roster.view_own', 'classes.attendance.take', 'classes.schedule.view_own',
    'students.view_own_class', 'students.profile.edit_own', 'students.profile.view_own',
    'timesheets.own.manage', 'teach.portal.access',
    'productions.scanner.scan', 'productions.tickets.purchase', 'productions.tickets.view_own',
    'comms.message.send'
  ];
  FOREACH v_key IN ARRAY v_perm_keys LOOP
    SELECT id INTO v_perm_id FROM permissions WHERE key = v_key;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- 5. front_desk
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'front_desk', 'Check-in, attendance, door scanning', '#D4A843', false)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'front_desk';
  v_perm_keys := ARRAY[
    'studio.dashboard.view', 'classes.roster.view_all', 'classes.attendance.take',
    'students.view_all', 'admin.portal.access',
    'productions.scanner.activate', 'productions.scanner.scan',
    'productions.tickets.purchase', 'productions.tickets.view_own'
  ];
  FOREACH v_key IN ARRAY v_perm_keys LOOP
    SELECT id INTO v_perm_id FROM permissions WHERE key = v_key;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- 6. parent (system role)
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'parent', 'View children, billing, schedule, communicate with studio', '#9E99A7', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'parent';
  v_perm_keys := ARRAY[
    'studio.billing.view_own', 'classes.schedule.view_own',
    'students.view_own_child', 'students.profile.edit_own', 'students.profile.view_own',
    'parent.portal.access', 'comms.message.send',
    'productions.tickets.purchase', 'productions.tickets.view_own'
  ];
  FOREACH v_key IN ARRAY v_perm_keys LOOP
    SELECT id INTO v_perm_id FROM permissions WHERE key = v_key;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- 7. student (system role)
  INSERT INTO roles (tenant_id, name, description, color, is_system)
  VALUES (v_tid, 'student', 'Own profile, schedule, tickets', '#D4D1D8', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tid AND name = 'student';
  v_perm_keys := ARRAY[
    'classes.schedule.view_own', 'students.profile.view_own',
    'parent.portal.access',
    'productions.tickets.purchase', 'productions.tickets.view_own'
  ];
  FOREACH v_key IN ARRAY v_perm_keys LOOP
    SELECT id INTO v_perm_id FROM permissions WHERE key = v_key;
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

END;
$$;
