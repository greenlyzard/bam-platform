-- Fix RLS recursion in communications-hub policies.
--
-- The original migration (20260409130000_communications_hub.sql) included a
-- self-referential policy on communication_group_members:
--
--   comm_group_members_same_group_select USING (
--     group_id IN (SELECT group_id FROM communication_group_members
--                  WHERE user_id = auth.uid())
--   )
--
-- Postgres re-evaluates the policy when reading from the same table inside
-- the policy itself, which causes infinite recursion / 500s. Several other
-- policies (communication_groups, group_posts, group_post_reactions) also
-- subqueried communication_group_members directly, which is fine on its own
-- but breaks the moment the recursive policy above fires.
--
-- Fix: introduce a SECURITY DEFINER helper that does the membership lookup
-- with RLS bypassed, then rewrite every "is the caller a member of group X"
-- check to call it.

-- ============================================================================
-- 1. Helper: is_member_of_group(group_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_member_of_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM communication_group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_member_of_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_member_of_group(uuid) TO authenticated;

-- ============================================================================
-- 2. communication_groups — replace member-select policy
-- ============================================================================
DROP POLICY IF EXISTS communication_groups_member_select ON communication_groups;
CREATE POLICY communication_groups_member_select ON communication_groups
  FOR SELECT USING (is_member_of_group(id));

-- ============================================================================
-- 3. communication_group_members — drop the recursive policy entirely
-- ============================================================================
-- Self-select stays (user_id = auth.uid()) — that's not recursive.
-- Admin all stays.
-- The "see other members of groups I'm in" capability is replaced with a
-- non-recursive policy via the helper.
DROP POLICY IF EXISTS comm_group_members_same_group_select ON communication_group_members;
CREATE POLICY comm_group_members_same_group_select ON communication_group_members
  FOR SELECT USING (is_member_of_group(group_id));

-- ============================================================================
-- 4. group_posts — rewrite member policies via helper
-- ============================================================================
DROP POLICY IF EXISTS group_posts_member_select ON group_posts;
CREATE POLICY group_posts_member_select ON group_posts
  FOR SELECT USING (is_member_of_group(group_id));

-- The insert policy used a member subquery with can_post=true; keep that
-- exact intent but call the helper for membership and inline the can_post
-- check separately so we still gate on the per-row flag.
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
-- Note: the EXISTS above is NOT recursive — it queries
-- communication_group_members from a policy on group_posts, which is a
-- different table. Safe.

-- ============================================================================
-- 5. group_post_reactions — rewrite member-select policy via helper
-- ============================================================================
DROP POLICY IF EXISTS group_post_reactions_member_select ON group_post_reactions;
CREATE POLICY group_post_reactions_member_select ON group_post_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_posts gp
      WHERE gp.id = group_post_reactions.post_id
        AND is_member_of_group(gp.group_id)
    )
  );

NOTIFY pgrst, 'reload schema';
