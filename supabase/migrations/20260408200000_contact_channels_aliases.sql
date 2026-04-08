-- Contact channel aliases — soft delete + label
-- Per docs/CONTACT_ALIASES.md Section 7

ALTER TABLE public.contact_channels
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid;

-- Composite indexes for fast inbound matching
CREATE INDEX IF NOT EXISTS idx_contact_channels_value_type
  ON public.contact_channels(value, channel_type)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_channels_tenant_value
  ON public.contact_channels(tenant_id, value)
  WHERE removed_at IS NULL;

NOTIFY pgrst, 'reload schema';
