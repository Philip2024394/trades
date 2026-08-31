-- 117_nex_call_record_text_identity.sql
--
-- NEX Calling · pure-NEX identity flow · Philip 2026-08-27.
--
-- Deletes the two Thenetworkers-auth-wrapped pages (nex-calling/people +
-- nex-calling/history) removed calls that stored their identities as
-- Supabase-auth UUIDs. The pure-NEX flow uses opaque identity STRINGS
-- (like "alice-dev-uuid" or future NEX-issued identifiers), not
-- Supabase UUIDs.
--
-- Idempotent: only alters columns if they are still UUID.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='call_record'
      AND column_name='caller_user_id' AND data_type='uuid'
  ) THEN
    ALTER TABLE nex.call_record ALTER COLUMN caller_user_id TYPE TEXT USING caller_user_id::text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='call_record'
      AND column_name='callee_user_id' AND data_type='uuid'
  ) THEN
    ALTER TABLE nex.call_record ALTER COLUMN callee_user_id TYPE TEXT USING callee_user_id::text;
  END IF;
END $$;

COMMENT ON COLUMN nex.call_record.caller_user_id IS
  'Pure-NEX identity string · not a Supabase auth UUID · Philip 2026-08-27. '
  'Opaque string · what the signalling server uses to route messages.';
COMMENT ON COLUMN nex.call_record.callee_user_id IS
  'Pure-NEX identity string · not a Supabase auth UUID · Philip 2026-08-27.';
