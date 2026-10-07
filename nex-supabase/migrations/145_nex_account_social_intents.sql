-- nex-supabase/migrations/145_nex_account_social_intents.sql
--
-- NEX Socials · signup intent chooser · founder-authorised 2026-10-07.
--
-- WHAT THIS DOES
--   1. Adds `nex_account.social_intents text[] NOT NULL DEFAULT '{}'`
--      · additive · no existing row touched (empty array means
--      "the user has not expressed a NEX Socials intent yet").
--   2. CHECK constraint restricts allowed values to the sealed four:
--        'business' · 'new_friends' · 'dating' · 'nightlife'
--      Expressed as a subset check against the four-element set.
--   3. GIN index on the column so a future discover-filter query like
--        WHERE social_intents && ARRAY['dating']::text[]
--      is index-backed (overlap operator is sargable on GIN).
--
-- WHY
--   The signup flow is adding an optional "Join NEX Socials" step
--   that invites new users to declare which of the four intents
--   match them (users may pick multiple · the four intents overlap
--   in real life). Storing this on nex_account rather than on
--   nex_account_profile keeps the signal tied to the identity, not
--   the public profile row (the latter is Phase 3A discoverability
--   territory and has its own gate).
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · The DEFAULT is empty · '{}' · never NULL. This keeps every
--     downstream query (`col && ARRAY[...]`) honest; NULL would be
--     silently filtered out.
--   · The CHECK is a subset test. Any INSERT or UPDATE that sets
--     social_intents to a value containing a token outside the
--     sealed four will fail. New intents require a follow-up migration
--     that extends this CHECK.
--   · This column is NEVER exposed over RLS to anonymous readers.
--     The nex_account table has no anon public-read policy (owner-
--     only + authenticated-friend-read patterns live on specific
--     service-layer paths · see account-service.ts).
--   · No data migration · every existing account inherits '{}'.
--
-- NOT TOUCHED
--   · nex_account_profile (Phase 3A discoverability stays sealed)
--   · nex_subscription_plan (Vault commercial Phase E stays deferred)
--   · nex_friend_edge (Phase 2 friends stays sealed)

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · additive column + default + CHECK
-- ----------------------------------------------------------------------------

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS social_intents text[]
    NOT NULL
    DEFAULT ARRAY[]::text[];

-- Drop any prior CHECK of the same name (idempotency · in case a
-- half-applied migration left one behind).
ALTER TABLE nex_account
  DROP CONSTRAINT IF EXISTS nex_account_social_intents_subset;

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_social_intents_subset
  CHECK (
    social_intents <@ ARRAY[
      'business',
      'new_friends',
      'dating',
      'nightlife'
    ]::text[]
  );

-- ----------------------------------------------------------------------------
-- 2 · GIN index · overlap-friendly
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS nex_account_social_intents_gin
  ON nex_account
  USING GIN (social_intents);

-- ----------------------------------------------------------------------------
-- 3 · migration-history record
-- ----------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '145',
    'nex_account · social_intents text[] · NEX Socials signup chooser',
    'NEX Socials founder-authorised 2026-10-07. Adds social_intents text[] NOT NULL DEFAULT ''{}'' with a subset CHECK restricting values to {business, new_friends, dating, nightlife}. Adds a GIN index so the discover-filter overlap operator is sargable. No existing row is touched; every account inherits the empty array which semantically means "intent not yet declared". Column is NOT exposed to anon readers; the nex_account table has no anon public-read policy and this migration adds none.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries · run manually, NOT inside the TX.
-- ============================================================================
--
-- -- Confirm the column + default:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'nex_account' AND column_name = 'social_intents';
--
-- -- Confirm the CHECK:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'nex_account'::regclass
--   AND conname = 'nex_account_social_intents_subset';
--
-- -- Confirm the GIN index:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'nex_account'
--   AND indexname = 'nex_account_social_intents_gin';
--
-- -- Confirm no existing row was flipped out of the default:
-- SELECT COUNT(*) AS declared_rows
-- FROM nex_account
-- WHERE array_length(social_intents, 1) IS NOT NULL;
-- -- expected: 0 immediately after apply
--
-- -- Reject an invalid token (should ERROR):
-- INSERT INTO nex_account (id, supabase_user_id, display_name, phone_country_code, phone_national_number, social_intents)
-- VALUES (gen_random_uuid(), gen_random_uuid(), 'probe', '+1', '0000000000', ARRAY['invalid']);
-- -- expected: ERROR  new row violates check constraint
