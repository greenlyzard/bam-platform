-- Add Attendance to admin nav under Staff group
INSERT INTO platform_modules (key, label, description, nav_group, icon, href, sort_order, platform_enabled, tenant_enabled, nav_visible)
VALUES ('attendance', 'Attendance', 'Class attendance tracking and reporting', 'Staff', '◉', '/admin/attendance', 25, true, true, true)
ON CONFLICT (key) DO NOTHING;
