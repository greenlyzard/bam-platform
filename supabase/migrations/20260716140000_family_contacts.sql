-- Create public.family_contacts (Option A) — the table 11 code sites already read/write but was
-- never created (phantom → 42P01 at runtime). Shape derived by reading EVERY write site:
--   enroll/actions.ts, portal/students/[studentId]/actions.ts, admin/families/actions.ts
-- (union of inserted columns), plus the inbound-comms lookup (email + tenant_id) and the
-- getFamilyContacts / portal.ts reads (order by is_primary, first_name).
--
-- Guarded / re-runnable (IF NOT EXISTS, DROP POLICY IF EXISTS). tenant_id NOT NULL. RLS via the
-- existing is_admin() profile_roles helper (+ a parent-own-family policy so the portal stream-
-- contact actions work). No forward FKs (tenants/families exist; created_by kept as a bare audit uuid).

CREATE TABLE IF NOT EXISTS public.family_contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  family_id         uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  contact_type      text NOT NULL,                 -- open/growing: emergency | stream | admin-set
  first_name        text NOT NULL,
  last_name         text NOT NULL,
  relationship      text,
  phone             text,
  email             text,
  notify_via_sms    boolean NOT NULL DEFAULT true,
  notify_via_email  boolean NOT NULL DEFAULT true,
  is_primary        boolean NOT NULL DEFAULT false,
  created_by        uuid,                           -- auth user (audit); no FK, matches convention
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes: family scope, tenant scope, and the inbound-comms email lookup (email + tenant_id).
CREATE INDEX IF NOT EXISTS idx_family_contacts_family        ON public.family_contacts (family_id);
CREATE INDEX IF NOT EXISTS idx_family_contacts_tenant        ON public.family_contacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_contacts_tenant_email  ON public.family_contacts (tenant_id, email)
  WHERE email IS NOT NULL;

-- RLS.
ALTER TABLE public.family_contacts ENABLE ROW LEVEL SECURITY;

-- Admins/finance/etc. manage all contacts (is_admin() = SECURITY DEFINER over profile_roles.user_id).
DROP POLICY IF EXISTS family_contacts_admin_all ON public.family_contacts;
CREATE POLICY family_contacts_admin_all ON public.family_contacts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- A parent manages the contacts of their own family (portal add/remove stream contact).
DROP POLICY IF EXISTS family_contacts_parent_own ON public.family_contacts;
CREATE POLICY family_contacts_parent_own ON public.family_contacts
  FOR ALL
  USING (family_id IN (SELECT id FROM public.families WHERE primary_contact_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT id FROM public.families WHERE primary_contact_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
