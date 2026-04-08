-- Communications classifier columns
-- Per docs/COMMUNICATIONS_TRIAGE.md Section 7

-- communication_messages: classifier metadata + spam flag
ALTER TABLE communication_messages
  ADD COLUMN IF NOT EXISTS is_spam boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS classifier_label text
    CHECK (classifier_label IN ('inquiry','review','spam')),
  ADD COLUMN IF NOT EXISTS classifier_signals jsonb DEFAULT '[]';

-- unmatched_sms: classifier metadata
-- (table may not exist on all environments — wrap in DO block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unmatched_sms') THEN
    ALTER TABLE unmatched_sms
      ADD COLUMN IF NOT EXISTS classifier_label text,
      ADD COLUMN IF NOT EXISTS is_spam boolean DEFAULT false;
  END IF;
END $$;

-- Spam log index for admin lookups
CREATE INDEX IF NOT EXISTS idx_comm_messages_spam
  ON communication_messages(tenant_id) WHERE is_spam = true;

NOTIFY pgrst, 'reload schema';
