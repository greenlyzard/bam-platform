-- ============================================================
-- RBAC System — Profile Roles, Permissions, Role Permissions
-- Creates: profile_roles, permissions, role_permissions
-- Migrates existing profiles.role data
-- Does NOT remove profiles.role (kept as fallback)
-- ============================================================


-- ── PROFILE ROLES ─────────────────────────────────────────
-- One user can have multiple roles per tenant (e.g. teacher + parent)
CREATE TABLE IF NOT EXISTS profile_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  tenant_id   UUID NOT NULL,
  role        TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_user ON profile_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_tenant ON profile_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role ON profile_roles(role);
CREATE INDEX IF NOT EXISTS idx_profile_roles_active ON profile_roles(is_active) WHERE is_active = true;

ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;

-- Admins can manage all roles
CREATE POLICY "admins_manage_roles" ON profile_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- Users can read their own roles
CREATE POLICY "users_read_own_roles" ON profile_roles
  FOR SELECT USING (user_id = auth.uid());


-- ── PERMISSIONS ───────────────────────────────────────────
-- Defines all available permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read permissions
CREATE POLICY "authenticated_read_permissions" ON permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only super_admin can modify permissions
CREATE POLICY "super_admin_manage_permissions" ON permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── ROLE PERMISSIONS ──────────────────────────────────────
-- Maps roles to permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          TEXT NOT NULL,
  permission_id UUID NOT NULL,
  tenant_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_role_perms" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "super_admin_manage_role_perms" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── SEED PERMISSIONS ──────────────────────────────────────
INSERT INTO permissions (key, label, description, category) VALUES
  -- Studio Management
  ('studio.settings.edit',       'Edit Studio Settings',       'Modify studio name, branding, hours',  'Studio Management'),
  ('studio.dashboard.view',      'View Studio Dashboard',      'Access admin dashboard and metrics',    'Studio Management'),
  ('studio.billing.manage',      'Manage Billing/Invoices',    'Create and manage invoices, payments',  'Studio Management'),
  ('studio.billing.view_own',    'View Own Invoices',          'View personal billing and invoices',    'Studio Management'),
  ('studio.staff.manage',        'Manage Staff Roles',         'Assign and modify staff roles',         'Studio Management'),
  ('studio.staff.view',          'View Staff List',            'View list of staff members',            'Studio Management'),

  -- Classes and Scheduling
  ('classes.manage',             'Create/Edit Classes',        'Create, edit, and delete classes',      'Classes'),
  ('classes.roster.view_all',    'View All Class Rosters',     'View rosters for any class',            'Classes'),
  ('classes.roster.view_own',    'View Own Class Roster',      'View roster for assigned classes',      'Classes'),
  ('classes.attendance.take',    'Take Attendance',            'Mark attendance for classes',            'Classes'),
  ('classes.schedule.view_own',  'View Own Schedule',          'View personal class schedule',           'Classes'),

  -- Students and Families
  ('students.view_all',          'View All Student Profiles',  'Access any student profile',             'Students'),
  ('students.view_own_class',    'View Own Class Students',    'View students in assigned classes',      'Students'),
  ('students.view_own_child',    'View Own Child Profile',     'View linked child profiles',             'Students'),
  ('students.profile.edit_own',  'Edit Own Profile',           'Edit personal profile details',          'Students'),
  ('students.profile.view_own',  'View Own Profile',           'View personal profile',                  'Students'),

  -- Productions and Ticketing
  ('productions.manage',         'Create/Edit Productions',    'Manage productions and casting',         'Productions'),
  ('productions.comps.manage',   'Manage Comp Allocation',     'Allocate complimentary tickets',         'Productions'),
  ('productions.scanner.activate','Activate Door Scanner',     'Enable scanning for events',             'Productions'),
  ('productions.scanner.scan',   'Scan Tickets at Door',       'Scan and validate tickets',              'Productions'),
  ('productions.push.send',      'Send Intermission Push',     'Send push notifications during events',  'Productions'),
  ('productions.tickets.purchase','Purchase Tickets',          'Buy tickets for events',                 'Productions'),
  ('productions.tickets.view_own','View Own Tickets',          'View personal ticket purchases',         'Productions'),

  -- Communications
  ('comms.templates.edit_baseline','Edit Baseline Templates', 'Modify platform-level email templates',  'Communications'),
  ('comms.templates.edit_studio', 'Edit Studio Templates',    'Modify studio email templates',           'Communications'),
  ('comms.announcements.send',   'Send Announcements',        'Send studio-wide announcements',          'Communications'),
  ('comms.inbox.view',           'View Comms Inbox',           'Access communications inbox',             'Communications'),
  ('comms.message.send',         'Send Message to Studio',     'Send messages to studio staff',           'Communications'),

  -- Timesheets
  ('timesheets.manage',          'Manage All Timesheets',      'Approve, flag, adjust timesheets',        'Timesheets'),
  ('timesheets.own.manage',      'Manage Own Timesheet',       'Log hours, submit own timesheet',         'Timesheets'),
  ('timesheets.payroll.view',    'View Payroll Reports',       'Access payroll report and export',         'Timesheets'),

  -- Admin Portal
  ('admin.portal.access',        'Access Admin Portal',        'Log into the admin portal',               'Portal Access'),
  ('teach.portal.access',        'Access Teacher Portal',      'Log into the teacher portal',             'Portal Access'),
  ('parent.portal.access',       'Access Parent Portal',       'Log into the parent portal',              'Portal Access'),

  -- Settings
  ('settings.platform.manage',   'Manage Platform Settings',   'Module control, feature flags, tenants',  'Settings')
ON CONFLICT (key) DO NOTHING;


-- ── SEED ROLE PERMISSIONS ─────────────────────────────────
-- super_admin gets everything
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions
ON CONFLICT DO NOTHING;

-- admin gets everything except platform settings and baseline templates
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE key NOT IN ('settings.platform.manage', 'comms.templates.edit_baseline')
ON CONFLICT DO NOTHING;

-- teacher: own classes, schedule, timesheets, teacher portal
INSERT INTO role_permissions (role, permission_id)
SELECT 'teacher', id FROM permissions
WHERE key IN (
  'classes.roster.view_own', 'classes.attendance.take', 'classes.schedule.view_own',
  'students.view_own_class', 'students.profile.edit_own', 'students.profile.view_own',
  'timesheets.own.manage', 'teach.portal.access',
  'productions.scanner.scan', 'productions.tickets.purchase', 'productions.tickets.view_own',
  'comms.message.send'
)
ON CONFLICT DO NOTHING;

-- parent: own children, billing, schedule, parent portal
INSERT INTO role_permissions (role, permission_id)
SELECT 'parent', id FROM permissions
WHERE key IN (
  'studio.billing.view_own', 'classes.schedule.view_own',
  'students.view_own_child', 'students.profile.edit_own', 'students.profile.view_own',
  'parent.portal.access', 'comms.message.send',
  'productions.tickets.purchase', 'productions.tickets.view_own'
)
ON CONFLICT DO NOTHING;

-- student: own profile, schedule
INSERT INTO role_permissions (role, permission_id)
SELECT 'student', id FROM permissions
WHERE key IN (
  'classes.schedule.view_own', 'students.profile.view_own',
  'parent.portal.access', 'productions.tickets.purchase', 'productions.tickets.view_own'
)
ON CONFLICT DO NOTHING;


-- ── MIGRATE EXISTING PROFILES.ROLE → PROFILE_ROLES ───────
-- Copy every user's current role from profiles into profile_roles
DO $$
DECLARE
  v_tid UUID;
BEGIN
  SELECT id INTO v_tid FROM tenants WHERE slug = 'bam' LIMIT 1;

  IF v_tid IS NOT NULL THEN
    INSERT INTO profile_roles (user_id, tenant_id, role, is_primary, is_active)
    SELECT p.id, v_tid, p.role::text, true, true
    FROM profiles p
    WHERE p.id IS NOT NULL
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  END IF;
END;
$$;


-- ── ENSURE AMANDA AND DEREK HAVE SUPER_ADMIN ─────────────
DO $$
DECLARE
  v_tid UUID;
  v_uid UUID;
BEGIN
  SELECT id INTO v_tid FROM tenants WHERE slug = 'bam' LIMIT 1;
  IF v_tid IS NULL THEN RETURN; END IF;

  -- Amanda
  SELECT id INTO v_uid FROM profiles WHERE email = 'amanda.cobb@bamsocal.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO profile_roles (user_id, tenant_id, role, is_primary, is_active)
    VALUES (v_uid, v_tid, 'super_admin', true, true)
    ON CONFLICT (user_id, tenant_id, role) DO UPDATE SET is_primary = true, is_active = true;

    UPDATE profiles SET role = 'super_admin' WHERE id = v_uid AND role != 'super_admin';
  END IF;

  -- Also check amandacobb@bamsocal.com (no dot variant)
  SELECT id INTO v_uid FROM profiles WHERE email = 'amandacobb@bamsocal.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO profile_roles (user_id, tenant_id, role, is_primary, is_active)
    VALUES (v_uid, v_tid, 'super_admin', true, true)
    ON CONFLICT (user_id, tenant_id, role) DO UPDATE SET is_primary = true, is_active = true;

    UPDATE profiles SET role = 'super_admin' WHERE id = v_uid AND role != 'super_admin';
  END IF;

  -- Derek
  SELECT id INTO v_uid FROM profiles WHERE email = 'derek@greenlyzard.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO profile_roles (user_id, tenant_id, role, is_primary, is_active)
    VALUES (v_uid, v_tid, 'super_admin', true, true)
    ON CONFLICT (user_id, tenant_id, role) DO UPDATE SET is_primary = true, is_active = true;

    UPDATE profiles SET role = 'super_admin' WHERE id = v_uid AND role != 'super_admin';
  END IF;
END;
$$;


-- ── UPDATED RLS HELPER — check profile_roles with fallback ──
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT pr.role FROM profile_roles pr
     WHERE pr.user_id = auth.uid() AND pr.is_active = true AND pr.is_primary = true
     LIMIT 1),
    (SELECT role::text FROM profiles WHERE id = auth.uid())
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'super_admin')
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(perm_key TEXT)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role = pr.role
    JOIN permissions p ON p.id = rp.permission_id
    WHERE pr.user_id = auth.uid()
      AND pr.is_active = true
      AND p.key = perm_key
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── TRIGGER ───────────────────────────────────────────────
CREATE TRIGGER set_profile_roles_updated_at
  BEFORE UPDATE ON profile_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
