-- 141_ledger_topup_intent_link_and_backstop.sql · Philip 2026-08-29
--
-- Link every real (post-Midtrans) top-up ledger row to its intent, and add
-- a partial UNIQUE index that makes a duplicate credit physically
-- impossible at the database layer.
--
-- Mirrors migration 139 (same pattern for network_fee). Together they form
-- the two-layer backstop: app-level SELECT ... FOR UPDATE + DB unique
-- index. Test #10 (idempotency) proves the app layer today; this index
-- catches any future refactor that removes the lock.
--
-- Pre-Midtrans stub top-ups keep related_topup_intent_id = NULL. New
-- Midtrans-backed credits set the FK. The UNIQUE index is partial —
-- NULLs don't participate — so old rows stay valid.
--
-- Doctrine anchor: lock 44 · immutable wallet ledger hardening.

ALTER TABLE nex.provider_wallet_transaction
  ADD COLUMN IF NOT EXISTS related_topup_intent_id uuid
    REFERENCES nex.provider_topup_intent(intent_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_wallet_transaction_one_topup_per_intent
  ON nex.provider_wallet_transaction (related_topup_intent_id)
  WHERE kind = 'topup' AND related_topup_intent_id IS NOT NULL;

COMMENT ON INDEX nex.uq_provider_wallet_transaction_one_topup_per_intent IS
  'DB backstop · at most one topup ledger row per Midtrans intent · '
  'Philip 2026-08-29 · migration 141 · mirrors migration 139 for network_fee';

CREATE INDEX IF NOT EXISTS idx_wallet_tx_topup_intent
  ON nex.provider_wallet_transaction (related_topup_intent_id)
  WHERE related_topup_intent_id IS NOT NULL;
