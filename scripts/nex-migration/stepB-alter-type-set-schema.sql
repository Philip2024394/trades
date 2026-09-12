-- Step B · Move 10 misplaced ENUM types from public → nex in a single transaction.
-- LOCAL nex_dev only. Walkers stopped. Supabase untouched. Fully reversible.
-- If ANY statement fails, the transaction is rolled back and nothing changes.

\set ON_ERROR_STOP on
\pset format aligned

BEGIN;

ALTER TYPE public.nex_food_claim_status      SET SCHEMA nex;
ALTER TYPE public.nex_food_enrichment_agent  SET SCHEMA nex;
ALTER TYPE public.nex_food_enrichment_status SET SCHEMA nex;
ALTER TYPE public.nex_food_event_type        SET SCHEMA nex;
ALTER TYPE public.nex_food_field_trust       SET SCHEMA nex;
ALTER TYPE public.nex_food_next_action       SET SCHEMA nex;
ALTER TYPE public.nex_food_outreach_channel  SET SCHEMA nex;
ALTER TYPE public.nex_food_outreach_status   SET SCHEMA nex;
ALTER TYPE public.nex_food_owner_status      SET SCHEMA nex;
ALTER TYPE public.nex_food_source_type       SET SCHEMA nex;

-- Sanity check inside the transaction. If any type is still in public, fail.
DO $body$
DECLARE
  stragglers int;
BEGIN
  SELECT count(*) INTO stragglers
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname LIKE 'nex_food_%';
  IF stragglers <> 0 THEN
    RAISE EXCEPTION 'Step B safety check FAILED · % types remain in public.*', stragglers;
  END IF;
END $body$;

COMMIT;

\echo
\echo === POST-COMMIT VERIFICATION ===
SELECT n.nspname AS schema, t.typname AS type_name
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname LIKE 'nex_food_%'
ORDER BY t.typname;
