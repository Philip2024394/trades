-- 137_nex_provider_wallet_and_fee.sql · Philip 2026-08-29
--
-- v5 locks:
--   Lock 37 · NEX takes 8% of agreed customer price
--   Lock 38 · 8% deducted from provider wallet, never charged to customer
--   Lock 39 · Monthly allowance = 2 completed requests with no network fee
--   Lock 41 · Wallet top-up tiers 20k/50k/100k/250k/500k IDR
--   Lock 42 · Wallet gate at eligibility
--   Lock 43 · Immutable price snapshot
--   Lock 44 · Wallet transaction ledger
--
-- Doctrine anchor: project_nex_mobility_doctrine_2026_08_29.md v5

-- ── Wallet table · one row per provider ───────────────────────────────
CREATE TABLE IF NOT EXISTS nex.provider_wallet (
  provider_id     uuid PRIMARY KEY REFERENCES nex.provider_profile(provider_id) ON DELETE CASCADE,
  balance_idr     integer NOT NULL DEFAULT 0 CHECK (balance_idr >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE nex.provider_wallet IS
  'Provider NEX wallet · never negative · lock 38 · Philip 2026-08-29';

-- ── Transaction ledger · every wallet change · immutable audit ────────
CREATE TABLE IF NOT EXISTS nex.provider_wallet_transaction (
  transaction_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id          uuid NOT NULL REFERENCES nex.provider_profile(provider_id) ON DELETE CASCADE,
  kind                 text NOT NULL CHECK (kind IN ('topup','network_fee','refund','adjustment')),
  amount_idr           integer NOT NULL,               -- signed · +topup · -fee · +refund
  balance_after_idr    integer NOT NULL CHECK (balance_after_idr >= 0),
  related_request_id   uuid REFERENCES nex.service_request(request_id) ON DELETE SET NULL,
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_provider_created ON nex.provider_wallet_transaction (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_related_request ON nex.provider_wallet_transaction (related_request_id) WHERE related_request_id IS NOT NULL;
COMMENT ON TABLE nex.provider_wallet_transaction IS
  'Immutable wallet ledger · lock 44 · Philip 2026-08-29';

-- ── Fee columns on service_request · lock 37/38/39 ────────────────────
ALTER TABLE nex.service_request
  ADD COLUMN IF NOT EXISTS network_fee_idr integer CHECK (network_fee_idr IS NULL OR network_fee_idr >= 0),
  ADD COLUMN IF NOT EXISTS network_fee_deducted_at timestamptz,
  ADD COLUMN IF NOT EXISTS was_free_allowance boolean;

COMMENT ON COLUMN nex.service_request.network_fee_idr IS
  '8% of price_agreed_idr · 0 when consumed monthly allowance · lock 39';
COMMENT ON COLUMN nex.service_request.was_free_allowance IS
  'True when this completed request consumed one of the provider''s 2 free-fee monthly slots';

-- ── Seed wallets for demo providers so they can operate ──────────────
INSERT INTO nex.provider_wallet (provider_id, balance_idr)
SELECT provider_id, 50000 FROM nex.provider_profile
  WHERE learner_ref LIKE 'device:demo-%'
ON CONFLICT (provider_id) DO NOTHING;

-- Seed a topup transaction for each so ledger is not empty
INSERT INTO nex.provider_wallet_transaction (provider_id, kind, amount_idr, balance_after_idr, note)
SELECT provider_id, 'topup', 50000, 50000, 'Seed balance for demo · Philip 2026-08-29'
FROM nex.provider_profile
WHERE learner_ref LIKE 'device:demo-%'
  AND NOT EXISTS (
    SELECT 1 FROM nex.provider_wallet_transaction t WHERE t.provider_id = nex.provider_profile.provider_id
  );
