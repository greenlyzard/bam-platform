-- Document Library — family_documents table
-- Per docs/DOCUMENT_LIBRARY.md Section 3
-- FK constraints intentionally omitted per CLAUDE.md migration rules.

CREATE TABLE IF NOT EXISTS family_documents (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL,
  family_id                uuid,
  student_id               uuid,
  document_type            text NOT NULL
    CHECK (document_type IN (
      'contract','waiver','policy_acknowledgment','invoice',
      'health_record','registration','custom_upload','google_doc'
    )),
  title                    text NOT NULL,
  description              text,

  -- Storage
  file_url                 text,
  external_url             text,
  file_size_bytes          integer,

  -- Signing / acknowledgment
  requires_signature       boolean DEFAULT false,
  signed_at                timestamptz,
  signed_by                uuid,
  signature_data           text,

  -- Expiry
  expires_at               date,
  expiry_reminder_sent_at  timestamptz,

  -- Status
  status                   text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','expired','voided','uploaded')),

  -- Visibility
  visible_to_parent        boolean NOT NULL DEFAULT true,
  visible_to_student       boolean NOT NULL DEFAULT false,

  -- Admin tracking
  uploaded_by              uuid,
  uploaded_on_behalf       boolean DEFAULT false,
  admin_notes              text,

  -- Linking
  enrollment_id            uuid,
  season_id                uuid,
  contract_template_id     uuid,

  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_docs_tenant   ON family_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_docs_family   ON family_documents(family_id);
CREATE INDEX IF NOT EXISTS idx_family_docs_student  ON family_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_family_docs_status   ON family_documents(status);
CREATE INDEX IF NOT EXISTS idx_family_docs_type     ON family_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_family_docs_expiry   ON family_documents(expires_at)
  WHERE expires_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
