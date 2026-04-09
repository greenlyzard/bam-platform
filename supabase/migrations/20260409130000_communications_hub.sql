-- Communications Hub — groups, feed posts, reactions, student privacy, absence RLS tightening
-- Spec: docs/COMMUNICATIONS_HUB.md §11
-- Per CLAUDE.md migration rules: no forward FK constraints, IF NOT EXISTS everywhere,
-- FK column to profiles is `user_id` (not `profile_id`).

-- ============================================================================
-- 1. communication_groups
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  name                text NOT NULL,
  description         text,
  group_type          text NOT NULL
    CHECK (group_type IN ('class','production','privates','private_session','studio_wide','custom')),
  chat_mode           text NOT NULL DEFAULT 'broadcast'
    CHECK (chat_mode IN ('broadcast','two_way','disabled')),
  class_id            uuid,
  production_id       uuid,
  private_session_id  uuid,
  is_active           boolean DEFAULT true,
  quiet_hours_start   time DEFAULT '21:00',
  quiet_hours_end     time DEFAULT '08:00',
  created_by          uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_groups_tenant      ON communication_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_communication_groups_type        ON communication_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_communication_groups_class       ON communication_groups(class_id);
CREATE INDEX IF NOT EXISTS idx_communication_groups_production  ON communication_groups(production_id);

-- ============================================================================
-- 2. communication_group_members
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_group_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  group_id              uuid NOT NULL,
  user_id               uuid NOT NULL,
  role                  text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin','moderator','member')),
  can_post              boolean DEFAULT false,
  notifications_enabled boolean DEFAULT true,
  joined_at             timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_group_members_group ON communication_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_comm_group_members_user  ON communication_group_members(user_id);

-- ============================================================================
-- 3. group_posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  group_id            uuid NOT NULL,
  author_id           uuid NOT NULL,
  post_type           text NOT NULL
    CHECK (post_type IN ('announcement','event','absence_notice','schedule_change','file','poll')),
  content             text,
  metadata            jsonb DEFAULT '{}'::jsonb,
  is_pinned           boolean DEFAULT false,
  view_count          integer DEFAULT 0,
  is_auto_generated   boolean DEFAULT false,
  related_session_id  uuid,
  related_class_id    uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_posts_group_created ON group_posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_posts_tenant        ON group_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_type          ON group_posts(post_type);

-- ============================================================================
-- 4. group_post_reactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_post_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL,
  user_id     uuid NOT NULL,
  emoji       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_group_post_reactions_post ON group_post_reactions(post_id);

-- ============================================================================
-- 5. students.privates_visible_in_group
-- ============================================================================
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS privates_visible_in_group boolean DEFAULT true;

-- ============================================================================
-- 6. RLS — communication_groups
-- ============================================================================
ALTER TABLE communication_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_groups_admin_all ON communication_groups;
CREATE POLICY communication_groups_admin_all ON communication_groups
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS communication_groups_member_select ON communication_groups;
CREATE POLICY communication_groups_member_select ON communication_groups
  FOR SELECT USING (
    id IN (
      SELECT group_id FROM communication_group_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. RLS — communication_group_members
-- ============================================================================
ALTER TABLE communication_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comm_group_members_admin_all ON communication_group_members;
CREATE POLICY comm_group_members_admin_all ON communication_group_members
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS comm_group_members_self_select ON communication_group_members;
CREATE POLICY comm_group_members_self_select ON communication_group_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS comm_group_members_same_group_select ON communication_group_members;
CREATE POLICY comm_group_members_same_group_select ON communication_group_members
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM communication_group_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. RLS — group_posts
-- ============================================================================
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_posts_admin_all ON group_posts;
CREATE POLICY group_posts_admin_all ON group_posts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS group_posts_member_select ON group_posts;
CREATE POLICY group_posts_member_select ON group_posts
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM communication_group_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS group_posts_member_insert ON group_posts;
CREATE POLICY group_posts_member_insert ON group_posts
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      is_teacher()
      OR EXISTS (
        SELECT 1 FROM communication_group_members
        WHERE group_id = group_posts.group_id
          AND user_id  = auth.uid()
          AND can_post = true
      )
    )
  );

DROP POLICY IF EXISTS group_posts_author_update ON group_posts;
CREATE POLICY group_posts_author_update ON group_posts
  FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS group_posts_author_delete ON group_posts;
CREATE POLICY group_posts_author_delete ON group_posts
  FOR DELETE USING (author_id = auth.uid());

-- ============================================================================
-- 9. RLS — group_post_reactions
-- ============================================================================
ALTER TABLE group_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_post_reactions_admin_all ON group_post_reactions;
CREATE POLICY group_post_reactions_admin_all ON group_post_reactions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS group_post_reactions_member_select ON group_post_reactions;
CREATE POLICY group_post_reactions_member_select ON group_post_reactions
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM group_posts WHERE group_id IN (
        SELECT group_id FROM communication_group_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS group_post_reactions_self_write ON group_post_reactions;
CREATE POLICY group_post_reactions_self_write ON group_post_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS group_post_reactions_self_delete ON group_post_reactions;
CREATE POLICY group_post_reactions_self_delete ON group_post_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 10. Tighten absence_records teacher policy
-- The original (20260409120000_absence_records.sql) lets any teacher SELECT all rows.
-- Replace with: teacher can SELECT only absences for classes they teach (via class_teachers).
-- Also add an explicit teacher UPDATE policy for the present_override workflow.
-- ============================================================================
DROP POLICY IF EXISTS absence_records_teacher_own ON absence_records;
CREATE POLICY absence_records_teacher_own ON absence_records
  FOR SELECT USING (
    is_teacher()
    AND class_id IN (
      SELECT class_id FROM class_teachers WHERE teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS absence_records_teacher_update ON absence_records;
CREATE POLICY absence_records_teacher_update ON absence_records
  FOR UPDATE USING (
    is_teacher()
    AND class_id IN (
      SELECT class_id FROM class_teachers WHERE teacher_id = auth.uid()
    )
  ) WITH CHECK (
    is_teacher()
    AND class_id IN (
      SELECT class_id FROM class_teachers WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================================
NOTIFY pgrst, 'reload schema';
