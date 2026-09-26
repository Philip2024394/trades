-- ============================================================================
-- NEX-native Migration 042 · nex_account_profile
-- ============================================================================
--
-- Purpose:
--   Bridge 2 · establish the authoritative NEX identity/discovery profile
--   layer. One row per nex_account. Holds "what best describes what you
--   do?" + the discovery attributes that later power the NEX Directory
--   (profession, skills, headline, bio, location, looking_for).
--
-- Doctrine references:
--   · Identity Doctrine · nex_account.id is the anchor · this table is a
--     one-to-one presentation/discovery projection on the same UUID.
--   · Source-of-truth Doctrine · this is the ONLY profile table. No parallel
--     professional/skills/identity tables. All discovery attributes live
--     here.
--   · Separation Doctrine · profile ≠ relationship ≠ conversation ≠ business.
--     A person may own a business (nex_business) AND have professional
--     attributes here; they are related but distinct entities.
--
-- Scope · what this migration DOES:
--   · CREATE nex_account_profile with the six-kind CHECK, string length
--     limits, array size limits, is_public flag.
--   · Attach the shared nex_touch_updated_at() trigger (migration 002).
--   · Enable RLS with owner read/insert/update policies + public read on
--     is_public rows.
--
-- Scope · what this migration DOES NOT touch:
--   · nex_account (no columns added · discovery attributes live in the
--     sibling table only).
--   · nex_conversation / nex_conversation_participant (Bridge 3 territory).
--   · nex_friend_edge (Bridge 3 territory).
--   · No RPC / SECURITY DEFINER · straight table + RLS.
--
-- FK behaviour:
--   account_id → nex_account(id) ON DELETE CASCADE
--     (profile has no meaning without the account · cascade is safe because
--     nex_account itself is only deleted via service-role admin operations).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '042';
--     DROP TABLE IF EXISTS nex_account_profile;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_account_profile (
  account_id      uuid PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE,
  kind            text,
  headline        text,
  bio             text,
  profession      text,
  skills          text[] NOT NULL DEFAULT '{}',
  location_label  text,
  looking_for     text[] NOT NULL DEFAULT '{}',
  is_public       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- The "what best describes what you do?" answer set. NULL is permitted
  -- so a profile row can exist before the question is answered (progressive
  -- disclosure at account creation may or may not run first).
  CONSTRAINT nex_account_profile_kind_known CHECK (
    kind IS NULL OR kind IN (
      'professional', 'business_owner', 'student',
      'seeking_work', 'exploring', 'other'
    )
  ),

  -- Length limits · mobile-first · protects the discovery index surface
  -- from unbounded strings. Bio is the most generous.
  CONSTRAINT nex_account_profile_headline_len       CHECK (headline       IS NULL OR length(headline)       <= 120),
  CONSTRAINT nex_account_profile_bio_len            CHECK (bio            IS NULL OR length(bio)            <= 1000),
  CONSTRAINT nex_account_profile_profession_len     CHECK (profession     IS NULL OR length(profession)     <= 80),
  CONSTRAINT nex_account_profile_location_label_len CHECK (location_label IS NULL OR length(location_label) <= 120),

  -- Array size + element length limits · matches nex_product tags convention
  -- (migration 017). Prevents unbounded input.
  CONSTRAINT nex_account_profile_skills_max
    CHECK (array_length(skills, 1) IS NULL OR array_length(skills, 1) <= 20),
  CONSTRAINT nex_account_profile_looking_for_max
    CHECK (array_length(looking_for, 1) IS NULL OR array_length(looking_for, 1) <= 10)
);

COMMENT ON TABLE nex_account_profile IS
  'NEX identity/discovery profile · one row per nex_account · kind = "what best describes what you do?" · additive to nex_account (never merged into it) · powers future NEX Directory discovery.';

COMMENT ON COLUMN nex_account_profile.kind IS
  'Onboarding answer: professional | business_owner | student | seeking_work | exploring | other · NULL until answered.';

COMMENT ON COLUMN nex_account_profile.is_public IS
  'When true, this profile is readable by unauthenticated callers via RLS (future Directory discovery). Owner can toggle off.';

-- Maintain updated_at on any UPDATE using the shared touch function from
-- migration 002. Follows the same DO $$ pattern as migration 025.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nex_touch_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_nex_account_profile_touch_updated_at ON nex_account_profile';
    EXECUTE 'CREATE TRIGGER trg_nex_account_profile_touch_updated_at
             BEFORE UPDATE ON nex_account_profile
             FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at()';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE nex_account_profile ENABLE ROW LEVEL SECURITY;

-- Owner can SELECT their own profile (regardless of is_public).
CREATE POLICY nex_account_profile_owner_read
  ON nex_account_profile
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Any authenticated OR anonymous caller can SELECT profiles marked public.
-- This is what future NEX Directory discovery will use. Non-public profiles
-- remain owner-only until the owner flips the flag.
CREATE POLICY nex_account_profile_public_read
  ON nex_account_profile
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Owner can INSERT exactly one row for their own account. Composite key
-- (account_id PK) prevents a duplicate row for the same account.
CREATE POLICY nex_account_profile_owner_insert
  ON nex_account_profile
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Owner can UPDATE their own row · cannot pivot account_id to a foreign
-- account (WITH CHECK enforces the new state too).
CREATE POLICY nex_account_profile_owner_update
  ON nex_account_profile
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- NO DELETE policy · profile deletion happens only via nex_account CASCADE,
-- which itself requires service-role. Owner deleting the account deletes
-- the profile. No standalone DELETE surface is needed.

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '042',
    'nex_account_profile · NEX identity/discovery profile · owner + public RLS',
    'Bridge 2 · Founder-authorised 2026-09-26. One-to-one with nex_account. Additive · does not modify nex_account. kind CHECK matches "what best describes what you do?" onboarding answer set. Bridge 3 Directory discovery will read via public RLS; Bridge 3 relationship + peer chat NOT touched here.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT tablename FROM pg_tables WHERE tablename = 'nex_account_profile';
--     -- expect: 1 row
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_account_profile'::regclass
--      AND conname LIKE 'nex_account_profile%';
--     -- expect: 7 constraints (PK + kind + 4 length + 2 array-size)
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'nex_account_profile'
--    ORDER BY policyname;
--     -- expect: 4 policies (owner_read, public_read, owner_insert, owner_update)
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'nex_account_profile'::regclass;
--     -- expect: trg_nex_account_profile_touch_updated_at
-- ============================================================================
