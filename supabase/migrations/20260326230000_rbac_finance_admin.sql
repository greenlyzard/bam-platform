-- ============================================================
-- RBAC — Finance Admin Role + Contact Privacy
-- ============================================================

-- Finance admin role helper (SECURITY DEFINER — same pattern as is_admin)
CREATE OR REPLACE FUNCTION public.is_finance_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid()
    AND role IN ('finance_admin', 'super_admin')
    AND is_active = true
  )
$$;

-- Only super_admin can assign finance_admin
CREATE OR REPLACE FUNCTION public.assign_finance_admin(target_user_id UUID, tenant UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only Studio Owners can assign finance roles';
  END IF;
  INSERT INTO profile_roles (user_id, role, tenant_id, is_active)
  VALUES (target_user_id, 'finance_admin', tenant, true)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_finance_admin(target_user_id UUID, tenant UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only Studio Owners can revoke finance roles';
  END IF;
  DELETE FROM profile_roles
  WHERE user_id = target_user_id
  AND role = 'finance_admin'
  AND tenant_id = tenant;
END;
$$;

-- Restrict rate cards to finance_admin and super_admin only
DROP POLICY IF EXISTS "Admins can manage rate cards" ON public.teacher_rate_cards;
DROP POLICY IF EXISTS "Finance can manage rate cards" ON public.teacher_rate_cards;
CREATE POLICY "Finance can manage rate cards" ON public.teacher_rate_cards
  FOR ALL USING (is_finance_admin());
