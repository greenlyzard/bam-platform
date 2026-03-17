-- ============================================================
-- Fix RLS infinite recursion on channel_members
--
-- Problem: "members_read_channel_members" policy on channel_members
-- queries channel_members itself → infinite recursion.
-- The "members_read_channels" and "members_read/insert_channel_messages"
-- policies also hit channel_members, triggering the same loop.
--
-- Fix: Two SECURITY DEFINER helper functions that bypass RLS,
-- then rewrite all affected policies to call them instead.
-- ============================================================

-- ── SECURITY DEFINER HELPERS ──────────────────────────────────

-- Returns true if the given user is a member of the given channel.
-- SECURITY DEFINER executes as the function owner (postgres),
-- bypassing RLS on channel_members.
CREATE OR REPLACE FUNCTION is_channel_member(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_members
    WHERE channel_id = p_channel_id
      AND profile_id = p_user_id
  );
$$;

-- Returns true if the given user has an active admin or super_admin role.
CREATE OR REPLACE FUNCTION is_tenant_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = p_user_id
      AND is_active = true
      AND role IN ('admin', 'super_admin')
  );
$$;


-- ── DROP OLD POLICIES ─────────────────────────────────────────

-- channel_members policies
DROP POLICY IF EXISTS "members_read_channel_members"  ON channel_members;
DROP POLICY IF EXISTS "admins_channel_members_all"     ON channel_members;
DROP POLICY IF EXISTS "users_update_own_membership"    ON channel_members;

-- channels policies
DROP POLICY IF EXISTS "members_read_channels"          ON channels;
DROP POLICY IF EXISTS "admins_channels_all"            ON channels;

-- channel_messages policies
DROP POLICY IF EXISTS "members_read_channel_messages"  ON channel_messages;
DROP POLICY IF EXISTS "members_insert_channel_messages" ON channel_messages;
DROP POLICY IF EXISTS "admins_channel_messages_all"    ON channel_messages;


-- ── NEW POLICIES: channel_members ─────────────────────────────

-- Members can see other members in channels they belong to
CREATE POLICY "members_read_channel_members" ON channel_members
  FOR SELECT USING (
    is_channel_member(channel_id, auth.uid())
  );

-- Admins have full access to channel_members
CREATE POLICY "admins_channel_members_all" ON channel_members
  FOR ALL USING (
    is_tenant_admin(auth.uid())
  );

-- Users can update their own membership row (last_read_at, is_muted)
CREATE POLICY "users_update_own_membership" ON channel_members
  FOR UPDATE USING (
    profile_id = auth.uid()
  );


-- ── NEW POLICIES: channels ───────────────────────────────────

-- Members can read channels they belong to
CREATE POLICY "members_read_channels" ON channels
  FOR SELECT USING (
    is_channel_member(id, auth.uid())
  );

-- Admins have full access to channels
CREATE POLICY "admins_channels_all" ON channels
  FOR ALL USING (
    is_tenant_admin(auth.uid())
  );


-- ── NEW POLICIES: channel_messages ────────────────────────────

-- Members can read messages in their channels
CREATE POLICY "members_read_channel_messages" ON channel_messages
  FOR SELECT USING (
    is_channel_member(channel_id, auth.uid())
  );

-- Members can send messages in their channels
CREATE POLICY "members_insert_channel_messages" ON channel_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_channel_member(channel_id, auth.uid())
  );

-- Admins have full access to channel_messages
CREATE POLICY "admins_channel_messages_all" ON channel_messages
  FOR ALL USING (
    is_tenant_admin(auth.uid())
  );
