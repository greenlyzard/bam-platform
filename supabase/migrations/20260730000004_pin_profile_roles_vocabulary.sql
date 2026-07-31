-- =============================================================================
-- Pin the role vocabulary on profile_roles
--
-- `profile_roles.role` is plain `text` with NO check constraint and NO enum
-- (verified live 2026-07-30: the only constraints on the table are the primary
-- key and UNIQUE (user_id, tenant_id, role)). Any string is accepted.
--
-- THE FAILURE THIS CLOSES: a typo is silently granted. Insert 'techer' or
-- 'Admin' or 'finance-admin' and the row is created, the admin UI renders it
-- as an assigned role, and the person appears to have been granted access —
-- but the string matches nothing in is_admin(), nothing in has_finance_role(),
-- and nothing in ROLE_ROUTES in proxy.ts, so they have no access at all and no
-- error is raised anywhere. It looks granted and does nothing.
--
-- WHY NOT THE `user_role` ENUM: it cannot express this vocabulary. Its labels
-- are only super_admin, admin, teacher, parent, student, front_desk — it has
-- no finance_admin, studio_admin or studio_manager. finance_admin is live on
-- Amanda Cobb's account today, so pinning to that enum would reject a role
-- currently in production use. The enum remains the type of the legacy
-- `profiles.role` mirror and is untouched here. See CLAUDE.md §4.
--
-- SCOPE: the nine values are exactly the ROLE_ROUTES keys in proxy.ts — the
-- set of roles the application can actually route. It is deliberately WIDER
-- than the five roles in use today (admin, finance_admin, parent, super_admin,
-- teacher), because studio_admin, studio_manager, front_desk and student are
-- all recognised by is_admin() and/or proxy.ts and are grantable from
-- /admin/settings/roles. Pinning to only what is in use would break a valid
-- grant the moment someone made one.
--
-- This constrains the vocabulary, not the authorization. Which roles may reach
-- which surface stays where it is — is_admin(), has_finance_role(), RLS.
--
-- PRE-FLIGHT: refuses and lists offending rows rather than deleting or
-- coercing them. `supabase db push` runs each migration in a transaction, so a
-- RAISE here rolls the whole thing back and changes nothing.
-- =============================================================================

DO $$
DECLARE
  -- The single source of the vocabulary WITHIN this migration: the pre-flight
  -- check and the constraint are both built from this array, so they cannot
  -- drift apart from each other.
  --
  -- They can still drift from the application. Four other lists define this
  -- same vocabulary today and none of them is generated from another:
  --   * is_admin() in the database (the 5 admin-tier roles)
  --   * ROLE_ROUTES in proxy.ts (all 9 — the list this constraint mirrors)
  --   * ALL_ROLES in app/(admin)/admin/settings/roles/roles-manager.tsx (all 9)
  --   * STAFF_ROLE_OPTIONS in lib/auth/staff-roles.ts (7 — no front_desk, no
  --     student)
  -- Adding a role means editing all of them. There is no mechanism that
  -- notices if you don't.
  allowed_roles text[] := ARRAY[
    'super_admin',
    'admin',
    'studio_admin',
    'finance_admin',
    'studio_manager',
    'front_desk',
    'teacher',
    'parent',
    'student'
  ];
  offender_count integer;
  offender_list  text;
BEGIN
  -- --------------------------------------------------------------------------
  -- Pre-flight: every existing row must already satisfy the constraint.
  -- --------------------------------------------------------------------------
  SELECT count(*),
         string_agg(
           format('  role=%L  id=%s  user_id=%s  is_active=%s',
                  pr.role, pr.id, pr.user_id, pr.is_active),
           E'\n' ORDER BY pr.role, pr.id
         )
    INTO offender_count, offender_list
    FROM public.profile_roles pr
   WHERE pr.role <> ALL (allowed_roles);

  IF offender_count > 0 THEN
    RAISE EXCEPTION E'profile_roles contains % row(s) outside the allowed role vocabulary. Refusing to add the constraint.\n\nOffending rows:\n%\n\nAllowed: %\n\nNothing has been changed. Decide per row whether each is a typo to correct or a role the vocabulary should gain, fix it by hand, then re-run this migration.',
      offender_count,
      offender_list,
      array_to_string(allowed_roles, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RAISE NOTICE 'profile_roles pre-flight passed: all rows within the allowed vocabulary.';

  -- --------------------------------------------------------------------------
  -- Add the constraint, if it is not already there.
  -- --------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.profile_roles'::regclass
       AND conname  = 'profile_roles_role_allowed'
  ) THEN
    RAISE NOTICE 'Constraint profile_roles_role_allowed already exists — skipping.';
  ELSE
    EXECUTE format(
      'ALTER TABLE public.profile_roles
         ADD CONSTRAINT profile_roles_role_allowed
         CHECK (role = ANY (%L::text[]))',
      allowed_roles
    );
    RAISE NOTICE 'Constraint profile_roles_role_allowed added.';
  END IF;
END $$;

COMMENT ON CONSTRAINT profile_roles_role_allowed ON public.profile_roles IS
  'Pins profile_roles.role to the nine routable roles. MUST stay in sync with '
  'ROLE_ROUTES in proxy.ts, ALL_ROLES in admin/settings/roles/roles-manager.tsx, '
  'STAFF_ROLE_OPTIONS in lib/auth/staff-roles.ts, and the admin-tier subset in '
  'is_admin(). Deliberately NOT the user_role enum: that enum has no '
  'finance_admin, which is live in production. See CLAUDE.md §4.';

NOTIFY pgrst, 'reload schema';
