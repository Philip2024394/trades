-- 139_network_fee_ledger_unique_backstop.sql · Philip 2026-08-29
--
-- Second line of protection against duplicate network-fee deductions.
--
-- The primary defence is the transactional flow in completeRequest():
--   · SELECT ... FOR UPDATE on the request row serialises concurrent
--     completion attempts
--   · state === 'COMPLETED' short-circuits repeat calls with 409
-- Test #10 (idempotency) proves this behaviour today.
--
-- This partial unique index is a database-level BACKSTOP: even if a future
-- refactor accidentally removed the state guard or the row lock, Postgres
-- would still refuse a second `network_fee` ledger row for the same
-- completed service request.
--
-- Scope: `kind = 'network_fee'` only. Other ledger kinds (`topup`, `refund`,
-- `adjustment`) can legitimately repeat per request — e.g., a
-- WALLET_UNDERFUNDED adjustment row plus a later refund, or multiple
-- adjustments during dispute resolution.
--
-- Doctrine anchor: v5 lock 44 (immutable wallet ledger) hardening.

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_wallet_transaction_one_network_fee_per_request
  ON nex.provider_wallet_transaction (related_request_id)
  WHERE kind = 'network_fee' AND related_request_id IS NOT NULL;

COMMENT ON INDEX nex.uq_provider_wallet_transaction_one_network_fee_per_request IS
  'DB backstop · at most one network_fee ledger row per completed service request · '
  'Philip 2026-08-29 · migration 139 · doctrine v5 lock 44';
