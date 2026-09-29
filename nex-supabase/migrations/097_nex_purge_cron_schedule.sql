-- Migration 097 · Schedule the delivered-encrypted purge · Bridge 85
-- ---------------------------------------------------------------------
-- Runs nex_purge_delivered_encrypted_messages(7) at :00 every hour so
-- ciphertext rows that were delivered ≥ 7 days ago get dropped without
-- ops intervention.
--
-- Prereq: pg_cron extension must be enabled. Migration 097 attempts to
-- create it inline (harmless if already enabled) then schedules the
-- job. Both operations are idempotent — re-running the migration
-- unschedules any previous version and re-schedules with the current
-- retention window.

create extension if not exists pg_cron;

-- Remove any prior schedule so re-applying the migration is safe.
do $$
declare
  jid bigint;
begin
  for jid in
    select jobid from cron.job where jobname = 'nex_purge_delivered_encrypted_hourly'
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;

select cron.schedule(
  'nex_purge_delivered_encrypted_hourly',
  '0 * * * *',
  $$select nex_purge_delivered_encrypted_messages(7)$$
);

comment on extension pg_cron is
  'Bridge 85 · Sealed 2026-09-29. Powers the hourly nex_purge_delivered_encrypted_hourly job that keeps the encrypted-message ciphertext table bounded per the "phone is the database" doctrine (server drops rows once delivered ≥ 7 days ago).';
