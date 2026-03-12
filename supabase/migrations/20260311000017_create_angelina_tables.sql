-- ============================================================
-- Migration: Angelina AI Assistant tables
-- Tables: angelina_conversations, angelina_feedback
-- ============================================================

-- ── angelina_conversations ──────────────────────────────────

CREATE TABLE angelina_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('public','parent','teacher','admin')),
  messages JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB,
  lead_email TEXT,
  lead_name TEXT,
  lead_child_name TEXT,
  lead_child_age INT,
  lead_converted BOOLEAN DEFAULT false,
  token_usage JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_angelina_conversations_user ON angelina_conversations(user_id);
CREATE INDEX idx_angelina_conversations_session ON angelina_conversations(session_id);
CREATE INDEX idx_angelina_conversations_tenant_role ON angelina_conversations(tenant_id, role);
CREATE INDEX idx_angelina_conversations_lead ON angelina_conversations(lead_converted, lead_email)
  WHERE lead_email IS NOT NULL;

CREATE TRIGGER set_angelina_conversations_updated_at
  BEFORE UPDATE ON angelina_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE angelina_conversations ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin: full access within tenant
CREATE POLICY angelina_conversations_all_admin ON angelina_conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','admin','front_desk')
    )
  );

-- Authenticated users: own rows only
CREATE POLICY angelina_conversations_own ON angelina_conversations
  FOR ALL USING (user_id = auth.uid());

-- Anonymous/public: insert only (no user_id match needed for insert)
CREATE POLICY angelina_conversations_public_insert ON angelina_conversations
  FOR INSERT WITH CHECK (role = 'public' AND user_id IS NULL);

-- Anonymous/public: select own session
CREATE POLICY angelina_conversations_public_select ON angelina_conversations
  FOR SELECT USING (role = 'public' AND user_id IS NULL);


-- ── angelina_feedback ───────────────────────────────────────

CREATE TABLE angelina_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES angelina_conversations(id) ON DELETE CASCADE,
  message_index INT NOT NULL,
  rating TEXT CHECK (rating IN ('helpful','not_helpful')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_angelina_feedback_conversation ON angelina_feedback(conversation_id);
CREATE INDEX idx_angelina_feedback_tenant ON angelina_feedback(tenant_id);

ALTER TABLE angelina_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback on conversations they can see
CREATE POLICY angelina_feedback_insert ON angelina_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM angelina_conversations
      WHERE angelina_conversations.id = conversation_id
      AND (angelina_conversations.user_id = auth.uid() OR angelina_conversations.role = 'public')
    )
  );

-- Admin can read all feedback
CREATE POLICY angelina_feedback_select_admin ON angelina_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','admin')
    )
  );
