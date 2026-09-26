-- ============================================================================
-- NEX-native Migration 008 · unique ledger reversal (Wave 3.1 · C2)
-- ============================================================================
--
-- Wave 3 §5 recorded an honest gap: reverseEntry() could be called twice
-- against the same original entry · producing two independent compensating
-- entries and doubling the reversal amount.
--
-- The NEX ledger model is: one original · one valid reversal · immutable
-- historical facts. Multiple independent reversals of the same original
-- have no legitimate business meaning at MVP.
--
-- Enforcement: partial UNIQUE index on nex_ledger_entry(reversal_of_entry_id)
-- where the column is not NULL. Original entries (reversal_of_entry_id NULL)
-- are unaffected · reversal entries can only exist ONCE per original.
--
-- No-role bypass: unique index applies at storage layer · service-role cannot
-- bypass indexes.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '008';
--     DROP INDEX IF EXISTS uq_nex_ledger_entry_unique_reversal;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_ledger_entry_unique_reversal
  ON nex_ledger_entry (reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;

COMMENT ON INDEX uq_nex_ledger_entry_unique_reversal IS
  'Partial UNIQUE · one reversal per original ledger entry. Original entries (NULL reversal_of_entry_id) unaffected. Service-role cannot bypass.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('008', 'nex_ledger_entry · partial UNIQUE index on reversal_of_entry_id · one valid reversal per original', 'Wave 3.1 · C2 · closes duplicate-reversal gap from Wave 3.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '008';
--   SELECT indexname FROM pg_indexes
--     WHERE indexname = 'uq_nex_ledger_entry_unique_reversal';
