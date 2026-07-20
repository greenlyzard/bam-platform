-- Retire the superseded Jul 15 "canonical billing family".
--
-- Superseded by the canonical specs:
--   docs/COMMERCE_AND_BILLING.md         (ledger_entries spine)
--   docs/BILLING_APPROVAL_AND_DRAW.md    (charges-based money record + refunds)
--
-- The tables dropped here were created by 20260715140000_billing_canonical_tables.sql
-- per the NON-CANONICAL draft docs/COMMERCE_BILLING_ARCHITECTURE.md (§4.1–4.5), which is
-- marked "not yet implemented" and is not registered in docs/_INDEX.md. The canonical
-- money model uses `charges` + `ledger_entries` and never references invoices/payments/
-- payment_allocations. All five tables are empty and unreferenced by application code.
--
-- Safety: this migration REFUSES to run if any table holds rows (pre-flight guard below),
-- so it can never destroy live billing data. Drops are IF EXISTS and NON-CASCADE — if a
-- drop fails on an unexpected dependency we want the error, not silent collateral drops.
--
-- NOTE (left for Derek's decision, intentionally NOT dropped here): the Jul 15 migration
-- also created the SECURITY DEFINER helper function public.auth_family_ids(). It is used
-- ONLY by the RLS policies of the five tables below (which drop with the tables). After
-- this migration it is orphaned but harmless. Retire it in a follow-up only if no future
-- billing table reuses it.

-- ── Pre-flight: refuse to drop any table that still holds data ────────────────────────
-- Each check is guarded by to_regclass so an already-dropped table is skipped, not errored.
DO $$
DECLARE
  v_count bigint;
  v_tbl   text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'public.refunds',
    'public.payment_allocations',
    'public.payments',
    'public.invoice_line_items',
    'public.invoices'
  ] LOOP
    IF to_regclass(v_tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s', v_tbl) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION
          'Refusing to retire legacy billing family: % holds % row(s). Archive/migrate this data before running this migration.',
          v_tbl, v_count;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── Drop in FK-dependency order (children first), non-cascade ──────────────────────────
-- refunds            → FK payment_id → payments
-- payment_allocations → FK payment_id → payments, invoice_id → invoices, line_item → invoice_line_items
-- payments           → (leaf parent once refunds + allocations are gone)
-- invoice_line_items → FK invoice_id → invoices
-- invoices           → (root)
-- Indexes and RLS policies are owned by these tables and drop automatically with them.
DROP TABLE IF EXISTS public.refunds;
DROP TABLE IF EXISTS public.payment_allocations;
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.invoice_line_items;
DROP TABLE IF EXISTS public.invoices;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
