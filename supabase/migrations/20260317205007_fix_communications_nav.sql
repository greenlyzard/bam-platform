-- ============================================================
-- Fix Communications nav items in admin sidebar
-- Problem: "Announcements" entry has tenant_enabled=false so it
-- doesn't show for non-Derek users. The "Inbox" entry from a
-- later migration routes to /inbox subpage, not the main page.
-- Fix: Update "announcements" to be the main Communications
-- link with tenant_enabled=true, and make Inbox a sub-item.
-- ============================================================

-- Rename the "announcements" module to "communications" and enable it
UPDATE platform_modules
SET
  key = 'communications',
  label = 'Communications',
  description = 'Channels, announcements, and unified inbox',
  icon = '✉',
  href = '/admin/communications',
  sort_order = 5,
  tenant_enabled = true,
  nav_visible = true
WHERE key = 'announcements';

-- Update the inbox entry to sort after the main Communications link
UPDATE platform_modules
SET
  sort_order = 10,
  label = 'Inbox',
  tenant_enabled = true,
  nav_visible = true
WHERE key = 'communications_inbox';
