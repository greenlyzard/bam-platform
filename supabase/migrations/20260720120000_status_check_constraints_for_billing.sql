-- Widen status CHECK constraints for the Billing Approval & Draw workflow (§9.2 new values).
-- Ref: docs/BILLING_APPROVAL_AND_DRAW.md §8.1 (enrollment states), §8.2 (intent states), §9.2.
--
-- The existing constraints (verified live 2026-07-20 via read-only MCP) BLOCK the new values,
-- so §9.2's status transitions would fail without this migration. We drop-and-recreate each
-- constraint with the UNION of old + new values. Each replacement is guarded by a pre-flight
-- DO block that proves EVERY live row already satisfies the NEW constraint before the old one
-- is dropped — so a bad row aborts the migration instead of leaving the table unconstrained.
--
-- Constraints replaced (old → new):
--   enrollments_status_check
--     old: active, waitlist, dropped, trial, completed
--     new: + pending, declined, expired, canceled, withdrawn        (§8.1 / §9.2)
--   tuition_schedule_intent_status_check
--     old: pending_setup, active, cancelled                          (note British 'cancelled')
--     new: pending_setup, active, dunning, paused, canceled          (§8.2 / §9.2)
--     SPELLING NORMALIZED (Derek 2026-07-20): the live constraint used 'cancelled' (British);
--     §9.2 standardizes on 'canceled' (American, matching the new canceled_at column). Verified
--     no code writes/compares 'cancelled' on this table (only app/api/enrollment/webhook/route.ts
--     touches it, writing 'pending_setup'). This migration converts any 'cancelled' rows to
--     'canceled' and the new CHECK admits only 'canceled' — the British spelling is retired.
--
-- Idempotent: guarded by pg_constraint checks; safe to re-run.

-- ── enrollments.status ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_bad bigint;
BEGIN
  -- Only act if the constraint is not already the widened one we intend to install.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_status_check') THEN
    -- Pre-flight: every live row must satisfy the NEW value set before we touch the constraint.
    SELECT count(*) INTO v_bad
    FROM public.enrollments
    WHERE status IS NOT NULL
      AND status NOT IN (
        'active','waitlist','dropped','trial','completed',   -- existing
        'pending','declined','expired','canceled','withdrawn' -- new (§9.2)
      );
    IF v_bad > 0 THEN
      RAISE EXCEPTION
        'Cannot widen enrollments_status_check: % live row(s) hold a status outside the new value set. Reconcile the data first.',
        v_bad;
    END IF;

    ALTER TABLE public.enrollments DROP CONSTRAINT enrollments_status_check;
    ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check
      CHECK (status IN (
        'active','waitlist','dropped','trial','completed',
        'pending','declined','expired','canceled','withdrawn'
      ));
  END IF;
END $$;

-- ── tuition_schedule_intent.status ────────────────────────────────────────────────────
DO $$
DECLARE
  v_bad bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tuition_schedule_intent_status_check') THEN
    -- Pre-flight accepts 'cancelled' as an input (it is normalized to 'canceled' just below);
    -- any value outside this convertible set is a genuine bad row and aborts the migration.
    SELECT count(*) INTO v_bad
    FROM public.tuition_schedule_intent
    WHERE status IS NOT NULL
      AND status NOT IN (
        'pending_setup','active','cancelled',   -- existing ('cancelled' converted next)
        'dunning','paused','canceled'            -- new (§9.2)
      );
    IF v_bad > 0 THEN
      RAISE EXCEPTION
        'Cannot widen tuition_schedule_intent_status_check: % live row(s) hold a status outside the new value set. Reconcile the data first.',
        v_bad;
    END IF;

    -- Normalize British → American spelling before installing the canonical-only constraint.
    UPDATE public.tuition_schedule_intent SET status = 'canceled' WHERE status = 'cancelled';

    ALTER TABLE public.tuition_schedule_intent DROP CONSTRAINT tuition_schedule_intent_status_check;
    ALTER TABLE public.tuition_schedule_intent ADD CONSTRAINT tuition_schedule_intent_status_check
      CHECK (status IN (
        'pending_setup','active',
        'dunning','paused','canceled'
      ));
  END IF;
END $$;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
