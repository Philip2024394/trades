-- ============================================================================
-- NEX-native Migration 006 · nex_ledger_entry + nex_ledger_line
-- ============================================================================
--
-- Purpose:
--   Double-entry accounting ledger. Each entry has 2+ lines · sum of
--   debits must equal sum of credits within an entry (application-level
--   enforcement · Postgres check per-line only). Reversal creates a new
--   compensating entry that references the reversed entry · historical
--   entries are NEVER mutated.
--
-- Doctrine references:
--   · Commercial Doctrine · Layer C (Commerce Ledger) · separate from
--     Wallet · records economic obligations
--   · Founder 2026-09-24 · "reversal-safe by design · reversals create
--     compensating entries · never mutate historical accounting facts"
--   · Founder 2026-09-24 · "Ledger writes must occur through a controlled
--     server-side service boundary" · enforced by RLS: service-role only
--
-- Not this migration:
--   · Full Nex Booker compliance (tax packages · period locks · accountant
--     grants) is deferred. This is the MVP ledger sufficient for the first
--     Founder Test.
--
-- Balanced-entry invariant:
--   Postgres CHECK enforces per-line: exactly one of debit_pence /
--   credit_pence is positive. Application enforces per-entry: sum of
--   debits = sum of credits. Enforced in ledger-service on write.
--
-- Reversal:
--   nex_ledger_entry.reversal_of_entry_id self-references the reversed
--   entry. When set, application must ensure the reversing entry has
--   lines that are the exact opposite (debits become credits and vice
--   versa) of the reversed entry. Historical facts remain untouched.
--
-- FK behaviour:
--   entry.order_id → RESTRICT (nullable · not every entry is order-related
--                     · but if set, order must exist)
--   entry.reversal_of_entry_id → RESTRICT (nullable · reversal target
--                                 must exist while reversal exists)
--   line.entry_id → CASCADE (deleting an entry deletes its lines ·
--                    although both are immutable so deletion is rare)
--
-- Immutability:
--   Both tables have NO INSERT/UPDATE/DELETE policies for authenticated
--   roles · all writes via service-role only. Combined with reversal
--   pattern, this guarantees historical accounting facts survive.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '006';
--     DROP TABLE IF EXISTS nex_ledger_line;
--     DROP TABLE IF EXISTS nex_ledger_entry;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nex_ledger_entry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_ledger_entry (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 uuid REFERENCES nex_order(id) ON DELETE RESTRICT,
    -- Nullable · not every accounting entry originates from an order
    -- (future: fees · adjustments · manual entries).
  description              text NOT NULL CHECK (length(trim(description)) > 0),
  reversal_of_entry_id     uuid REFERENCES nex_ledger_entry(id) ON DELETE RESTRICT,
    -- When set, this entry reverses the referenced entry. Application
    -- enforces that lines are opposite (debits/credits swapped). Historical
    -- facts survive.
  created_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_ledger_entry IS
  'Immutable double-entry journal entry. Reversal via new entry that references reversal_of_entry_id · never mutation. Written by service-role only.';

COMMENT ON COLUMN nex_ledger_entry.reversal_of_entry_id IS
  'Self-reference to the entry being reversed. When set, application ensures reversing lines are exact opposite (debits/credits swapped).';

CREATE INDEX IF NOT EXISTS idx_nex_ledger_entry_order_id
  ON nex_ledger_entry (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_ledger_entry_reversal_of_entry_id
  ON nex_ledger_entry (reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. nex_ledger_line
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_ledger_line (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id           uuid NOT NULL REFERENCES nex_ledger_entry(id) ON DELETE CASCADE,
  account            text NOT NULL CHECK (length(trim(account)) > 0),
    -- Ledger-sense account name · text · not FK to nex_account.
    -- Examples: 'cash' · 'accounts_receivable' · 'revenue' ·
    --           'commission_payable' · 'refunds_paid'
  debit_pence        bigint NOT NULL DEFAULT 0 CHECK (debit_pence >= 0),
  credit_pence       bigint NOT NULL DEFAULT 0 CHECK (credit_pence >= 0),
  currency           text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_line_exactly_one_side
    CHECK ((debit_pence > 0 AND credit_pence = 0) OR (debit_pence = 0 AND credit_pence > 0))
    -- Every line is EXACTLY a debit or EXACTLY a credit · never both · never neither.
);

COMMENT ON TABLE nex_ledger_line IS
  'One side of a double-entry. Exactly one of debit_pence / credit_pence is positive. Ledger-service enforces per-entry balance (sum debits = sum credits) at write time.';

COMMENT ON COLUMN nex_ledger_line.account IS
  'Ledger-sense account name (text · not a FK). Examples: cash · accounts_receivable · revenue · commission_payable.';

CREATE INDEX IF NOT EXISTS idx_nex_ledger_line_entry_id
  ON nex_ledger_line (entry_id);

CREATE INDEX IF NOT EXISTS idx_nex_ledger_line_account
  ON nex_ledger_line (account);

-- ---------------------------------------------------------------------------
-- 3. RLS · service-role only
-- ---------------------------------------------------------------------------
ALTER TABLE nex_ledger_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_ledger_line ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated · ledger is internal accounting
-- · only service-role can read/write · service-role bypasses RLS by design.

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('006', 'nex_ledger_entry + nex_ledger_line · double-entry · reversal-safe · service-role-only · balanced-entry enforced in application', 'Every line is exactly a debit or credit (Postgres CHECK). Per-entry sum-debits = sum-credits enforced by ledger-service at write time. Reversal via new entry, never mutation.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '006';
--   SELECT count(*) FROM nex_ledger_entry;
--   SELECT count(*) FROM nex_ledger_line;
--   -- Verify CHECK constraint fires:
--   -- (do NOT run against production · test in dev only)
--   -- INSERT INTO nex_ledger_line (entry_id, account, debit_pence, credit_pence, currency)
--   --   VALUES ('<some-entry-uuid>', 'test', 100, 100, 'GBP');
--   -- expect: ERROR · violates chk_line_exactly_one_side
