-- ============================================================
-- Communications Phase 1 — Channels & Channel Messages
-- Replaces empty message_threads / messages tables with
-- channels, channel_members, channel_messages
-- ============================================================

-- ── DROP EMPTY LEGACY TABLES ────────────────────────────────
-- Per spec section 11.2: both confirmed empty, safe to drop.
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS message_threads CASCADE;


-- ── CHANNELS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  name              text NOT NULL,
  description       text,
  type              text NOT NULL CHECK (type IN (
                      'class_group',
                      'production_group',
                      'admin_group',
                      'parent_group',
                      'student_group',
                      'direct_message',
                      'announcement',
                      'general'
                    )),
  icon_url          text,
  is_archived       boolean NOT NULL DEFAULT false,
  created_by        uuid,
  class_id          uuid,
  production_id     uuid,
  last_message_at   timestamptz,
  pinned_post_id    uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_tenant ON channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_channels_last_msg ON channels(tenant_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_channels_class ON channels(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channels_production ON channels(production_id) WHERE production_id IS NOT NULL;


-- ── CHANNEL MEMBERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL,
  role          text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz,
  is_muted      boolean NOT NULL DEFAULT false,
  UNIQUE (channel_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_profile ON channel_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);


-- ── CHANNEL MESSAGES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id     uuid,
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text'
                  CHECK (message_type IN ('text', 'system')),
  reply_to_id   uuid,
  edited_at     timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender ON channel_messages(sender_id);


-- ── TRIGGERS ────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER set_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- Channels: members can read channels they belong to
CREATE POLICY "members_read_channels" ON channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
        AND channel_members.profile_id = auth.uid()
    )
  );

-- Channels: admins have full access
CREATE POLICY "admins_channels_all" ON channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profile_roles
      WHERE profile_roles.user_id = auth.uid()
        AND profile_roles.is_active = true
        AND profile_roles.role IN ('admin', 'super_admin')
    )
  );

-- Channel members: members can read membership of their channels
CREATE POLICY "members_read_channel_members" ON channel_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_members my_membership
      WHERE my_membership.channel_id = channel_members.channel_id
        AND my_membership.profile_id = auth.uid()
    )
  );

-- Channel members: admins have full access
CREATE POLICY "admins_channel_members_all" ON channel_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profile_roles
      WHERE profile_roles.user_id = auth.uid()
        AND profile_roles.is_active = true
        AND profile_roles.role IN ('admin', 'super_admin')
    )
  );

-- Channel members: users can update their own membership (last_read_at, is_muted)
CREATE POLICY "users_update_own_membership" ON channel_members
  FOR UPDATE USING (profile_id = auth.uid());

-- Channel messages: members can read messages in their channels
CREATE POLICY "members_read_channel_messages" ON channel_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_messages.channel_id
        AND channel_members.profile_id = auth.uid()
    )
  );

-- Channel messages: members can insert messages in their channels
CREATE POLICY "members_insert_channel_messages" ON channel_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_messages.channel_id
        AND channel_members.profile_id = auth.uid()
    )
  );

-- Channel messages: admins have full access
CREATE POLICY "admins_channel_messages_all" ON channel_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profile_roles
      WHERE profile_roles.user_id = auth.uid()
        AND profile_roles.is_active = true
        AND profile_roles.role IN ('admin', 'super_admin')
    )
  );
