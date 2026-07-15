-- Commerce & Billing — Build Sequence Layer 2: harden ledger_entries dimensions.
-- Ref: docs/COMMERCE_BILLING_ARCHITECTURE.md §4.20 ("add teacher_id + award_id dimensions;
--      add FK event_id -> productions(id); all nullable"), §11.1/§13 idempotent posting
--      ("Unique ledger_entries (event_id, account, direction)"), §16 migration note.
--
-- Verified live 2026-07-15 (bam-schema-sync, read-only):
--   ledger_entries PK = id; existing FKs: class_id->classes, family_id->families,
--     location_id->studio_locations, tenant_id->tenants; event_id has NO FK; 0 rows.
--   teachers PK = id; productions PK = id.
--   award_definitions/award_grants do NOT exist -> award_id gets NO forward FK.
--
-- Safely re-runnable: every statement is guarded (IF NOT EXISTS / constraint-name check).
-- ON DELETE SET NULL on both new FKs, matching the table's existing dimension FKs
-- (ledger history must survive deletion of a teacher or production).

-- 1. teacher_id dimension (per-teacher P&L).
ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS teacher_id uuid;

-- 2. award_id dimension — NO FK (award_definitions/award_grants not built yet).
ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS award_id uuid;

-- 3. FK: teacher_id -> teachers(id). Guarded so a re-run is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ledger_entries_teacher_id_fkey'
      AND conrelid = 'public.ledger_entries'::regclass
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT ledger_entries_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. FK on the EXISTING event_id column -> productions(id), only if absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ledger_entries_event_id_fkey'
      AND conrelid = 'public.ledger_entries'::regclass
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT ledger_entries_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.productions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Partial unique index for idempotent event posting (one entry per
--    event/account/direction). Only where an event is tagged.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_entries_event_account_direction
  ON public.ledger_entries (event_id, account, direction)
  WHERE event_id IS NOT NULL;

COMMENT ON COLUMN public.ledger_entries.teacher_id IS
  'Teacher P&L dimension — attributes revenue/labor to a teacher (COMMERCE_BILLING_ARCHITECTURE.md §4.20). FK -> teachers(id).';
COMMENT ON COLUMN public.ledger_entries.award_id IS
  'Applied award/scholarship/discount grant. No FK yet — award_definitions/award_grants not built (COMMERCE_BILLING_ARCHITECTURE.md §4.10/§4.11). Add FK when they land.';

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
