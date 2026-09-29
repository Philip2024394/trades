-- Migration 096 · Zero-knowledge signup acknowledgment · Bridge 82
-- -----------------------------------------------------------------
-- Founder direction 2026-09-29: users must explicitly acknowledge
-- at signup that NEX does not store their chat content · their phone
-- IS the database · losing the phone means losing history · this is
-- the intentional trade-off for maximum privacy.
--
-- The column records WHEN they acknowledged (nullable · null until
-- they tick the checkbox on /create-account). Not a boolean because
-- (a) provable timestamp is legally cleaner for "you were told"
-- disputes and (b) lets us re-prompt after a doctrine revision
-- without a schema change.

alter table nex_account
  add column if not exists zero_knowledge_ack_at timestamptz;

comment on column nex_account.zero_knowledge_ack_at is
  'Bridge 82 · Sealed 2026-09-29. Timestamp when the user acknowledged the "phone is the database" doctrine at signup. Null on accounts created before Bridge 82 lands · legacy accounts implicitly grandfathered but should be re-prompted on next sign-in.';
