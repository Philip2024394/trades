-- Migration 094 · Purge job for delivered encrypted peer messages · Bridge 78
-- ---------------------------------------------------------------------------
-- Cost-savings mechanism for the "phone is storage" doctrine sealed
-- 2026-09-29. Once every recipient device has decrypted an encrypted
-- row (Bridge 76 marks delivered_at via _e2e-decryptor's ack POST),
-- the server holds nothing the client can't reproduce from its
-- IndexedDB copy. The ciphertext then becomes pure storage cost with
-- no product value · we drop it after a grace period.
--
-- Retention rules:
--   · Only encrypted rows are eligible (encrypted=true)
--   · Only rows that were successfully decrypted (delivered_at not null)
--   · Only rows older than <retain_days> (default 7) since delivery
--
-- Legacy plaintext rows are NEVER purged by this function · deleting
-- them would lose user history. Encrypted-but-undelivered rows (peer
-- never opened the chat) also stay — they're the ONLY way the peer
-- can still receive the message.
--
-- SECURITY DEFINER · runs under the migration role so callers don't
-- need write access to nex_peer_message. Guarded with a numeric floor
-- on retain_days so a misconfigured caller can't purge fresh rows.

create or replace function nex_purge_delivered_encrypted_messages(
  retain_days int default 7
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_days int;
  purged int;
begin
  -- Never purge anything less than 1 day old · even if a caller
  -- passes 0 or negative. Protects against a misconfigured cron.
  effective_days := greatest(retain_days, 1);

  with victims as (
    delete from nex_peer_message
    where encrypted = true
      and delivered_at is not null
      and delivered_at < (now() - (effective_days || ' days')::interval)
    returning id
  )
  select count(*) into purged from victims;

  return purged;
end;
$$;

comment on function nex_purge_delivered_encrypted_messages(int) is
  'Bridge 78 · Sealed 2026-09-29. Deletes encrypted peer messages that have been decrypted by the recipient at least <retain_days> ago (default 7). Returns count of rows removed. Never touches plaintext rows or undelivered encrypted rows. Safe to run on any interval — idempotent, purges only ripe rows.';

-- To schedule automatic hourly purges, run this in the Supabase SQL
-- editor AFTER enabling the pg_cron extension (Database → Extensions):
--
--   select cron.schedule(
--     'nex_purge_delivered_encrypted_hourly',
--     '0 * * * *',
--     $$select nex_purge_delivered_encrypted_messages(7)$$
--   );
--
-- Alternatively, run scripts/nex-e2e/purge-delivered-encrypted.mjs
-- from an external cron host (Vercel Cron / GitHub Actions / systemd)
-- if pg_cron isn't available on the project.
