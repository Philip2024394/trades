-- 140_provider_topup_intent.sql · Philip 2026-08-29
--
-- Midtrans wallet-top-up idempotency backbone (Phase 4a).
--
-- Every top-up starts life as a `provider_topup_intent` row. NEX generates
-- the order_id (UUID) BEFORE calling Midtrans, so the whole flow can be
-- re-driven safely from any point:
--   · client crashes after /initiate but before opening Snap → intent stays
--     `pending`, no wallet credit, can be reconciled or expired
--   · Midtrans webhook arrives after user closes NEX → intent flips to
--     `paid`, wallet credited exactly once (backstop in migration 141)
--   · duplicate webhook → SELECT ... FOR UPDATE sees terminal state, no-op
--
-- Amount CHECK constraint locks the 5 approved tiers. Snap will never see a
-- Rp 12,345 intent — the DB refuses it.
--
-- Doctrine anchors:
--   · project_nex_midtrans_integration_research_report (Philip approved design)
--   · lock 41 · top-up tiers 20k/50k/100k/250k/500k IDR
--   · lock 44 · wallet ledger is source of truth (see migration 141)

CREATE TABLE IF NOT EXISTS nex.provider_topup_intent (
  intent_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id              uuid NOT NULL REFERENCES nex.provider_profile(provider_id) ON DELETE CASCADE,
  amount_idr               integer NOT NULL
    CHECK (amount_idr IN (20000, 50000, 100000, 250000, 500000)),
  midtrans_order_id        text NOT NULL UNIQUE,
  midtrans_transaction_id  text,
  midtrans_payment_type    text,
  snap_token               text,
  snap_redirect_url        text,
  state                    text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'paid', 'denied', 'cancelled', 'expired', 'failed')),
  last_webhook_at          timestamptz,
  last_webhook_status      text,          -- raw transaction_status from most-recent webhook
  credited_at              timestamptz,   -- set exactly once when wallet credited
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topup_intent_provider_created
  ON nex.provider_topup_intent (provider_id, created_at DESC);

-- Partial index for the reconcile-stuck-pending job (Phase 5+).
CREATE INDEX IF NOT EXISTS idx_topup_intent_pending
  ON nex.provider_topup_intent (created_at)
  WHERE state = 'pending';

COMMENT ON TABLE nex.provider_topup_intent IS
  'One row per top-up attempt · NEX-generated order_id is the Midtrans reference · '
  'idempotency backbone for the wallet-credit path · Philip 2026-08-29 · migration 140';
COMMENT ON COLUMN nex.provider_topup_intent.credited_at IS
  'Non-null AFTER the wallet has been credited exactly once. Together with the '
  'partial UNIQUE index on provider_wallet_transaction (migration 141), this makes '
  'a duplicate credit impossible even if the app logic is later broken.';
