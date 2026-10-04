-- nex-supabase/migrations/135_nex_theme_intro.sql
--
-- NEX Phase 4A · Premium theme intro-video mechanism.
-- Founder-authorised 2026-10-04.
--
-- WHAT THIS DOES
--   1. Adds three ADDITIVE nullable columns to `nex_chat_theme`:
--        · intro_video_url    text · optional cinematic intro asset
--        · intro_duration_ms  bigint · nominal video duration (informational)
--        · intro_poster_url   text · optional still-frame while loading
--      Every existing row stays unchanged (NULL across all three) so the
--      intro feature is dormant until an admin uploads a video for a
--      specific theme.
--
--   2. Creates a per-user × per-theme "seen" tracker:
--        · nex_theme_intro_seen (account_id uuid, theme_id text, seen_at
--          timestamptz) · composite PRIMARY KEY · one row per pair ·
--          CASCADE on account delete.
--      RLS: owner can SELECT and INSERT their own rows · no UPDATE or
--      DELETE policy (seen-state is append-only · a user has seen it
--      forever once marked).
--
-- WHY SEPARATE TABLE
--   · Matches the Phase 3A `is_discoverable` additive pattern · RLS stays
--     the primary boundary · no account-row mutation on every mark-seen.
--   · Keeps the state model simple: a (viewer, theme) pair is the exact
--     scope · not tied to a conversation · entering any Joker-themed chat
--     after seeing a Joker intro once gives fast entry forever.
--
-- WHAT THIS DOES NOT DO
--   · No sponsorship / advertising columns (dropped from scope per
--     founder decision 2026-10-04).
--   · No analytics / telemetry columns.
--   · No seeded intro URLs on existing premium themes (Joker · Haunted
--     Hotel · Pink Dream) · admin uploads videos later.
--   · No data migration of existing rows · all stay unchanged.
--
-- WHAT HAPPENS IF NO INTRO IS SET
--   · intro_video_url IS NULL → the chat shell renders immediately as
--     today · zero behaviour change for any theme without an intro.
--   · This is the state of all 41 themes at migration time.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · additive columns on nex_chat_theme
-- ---------------------------------------------------------------------------
ALTER TABLE nex_chat_theme
  ADD COLUMN IF NOT EXISTS intro_video_url text,
  ADD COLUMN IF NOT EXISTS intro_duration_ms bigint,
  ADD COLUMN IF NOT EXISTS intro_poster_url text;

ALTER TABLE nex_chat_theme
  ADD CONSTRAINT nex_chat_theme_intro_video_url_length
    CHECK (intro_video_url IS NULL OR char_length(intro_video_url) <= 2048),
  ADD CONSTRAINT nex_chat_theme_intro_poster_url_length
    CHECK (intro_poster_url IS NULL OR char_length(intro_poster_url) <= 2048),
  ADD CONSTRAINT nex_chat_theme_intro_duration_ms_range
    CHECK (intro_duration_ms IS NULL OR (intro_duration_ms > 0 AND intro_duration_ms <= 10000));

COMMENT ON COLUMN nex_chat_theme.intro_video_url IS
  'Phase 4A · optional cinematic intro video served before the themed '
  'chat shell renders. NULL = no intro · shell renders immediately. '
  'See migration 135.';

COMMENT ON COLUMN nex_chat_theme.intro_duration_ms IS
  'Phase 4A · nominal video duration in milliseconds · informational '
  'only. The client never waits past this value · it respects the '
  'actual video onended event · and in all cases a hard 5000 ms safety '
  'ceiling applies.';

COMMENT ON COLUMN nex_chat_theme.intro_poster_url IS
  'Phase 4A · optional still-frame shown while the intro video '
  'downloads · prevents blank frame flash. NULL = no poster.';

-- ---------------------------------------------------------------------------
-- 2 · nex_theme_intro_seen · per-user × per-theme seen tracker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_theme_intro_seen (
  account_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  theme_id   text NOT NULL REFERENCES nex_chat_theme(id) ON DELETE CASCADE,
  seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, theme_id)
);

COMMENT ON TABLE nex_theme_intro_seen IS
  'Phase 4A · tracks whether a given account has ever seen a given '
  'theme intro video. One row per (account, theme) pair · append-only '
  '· the row existing means "seen". Owner RLS only · no public read.';

ALTER TABLE nex_theme_intro_seen ENABLE ROW LEVEL SECURITY;

-- Owner can SELECT their own seen state (needed server-side to decide
-- whether to play the intro for the viewer).
CREATE POLICY nex_theme_intro_seen_owner_read
  ON nex_theme_intro_seen
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Owner can INSERT exactly their own rows · UPDATE/DELETE not needed
-- (seen state is permanent; CASCADE handles account deletion).
CREATE POLICY nex_theme_intro_seen_owner_insert
  ON nex_theme_intro_seen
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- No DELETE policy · intentional. Seen is forever.
-- No UPDATE policy · the row's only mutable field is seen_at which has
-- no reason to change once set.

-- ---------------------------------------------------------------------------
-- 3 · migration ledger
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '135',
    'nex_chat_theme intro columns + nex_theme_intro_seen tracker · Phase 4A',
    'Phase 4A founder-authorised 2026-10-04. Adds intro_video_url / intro_duration_ms / intro_poster_url (all nullable, additive) to nex_chat_theme · all 41 existing rows stay NULL across the three columns so the intro feature is dormant until an admin uploads a video. Creates nex_theme_intro_seen (account_id, theme_id, seen_at) with composite PK · owner RLS SELECT + INSERT only · no UPDATE / DELETE · append-only seen state. No sponsorship columns (dropped from scope). No seeded intros. No data migration.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries (run manually against the live DB):
--
-- 1 · Columns exist with correct types + constraints:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'nex_chat_theme'
--   AND column_name IN ('intro_video_url','intro_duration_ms','intro_poster_url');
--
-- 2 · No existing row has an intro set:
-- SELECT COUNT(*) FROM nex_chat_theme WHERE intro_video_url IS NOT NULL;
-- -- expected: 0
--
-- 3 · New table + RLS exists:
-- SELECT polname FROM pg_policy
--  WHERE polrelid = 'nex_theme_intro_seen'::regclass ORDER BY polname;
-- -- expected: nex_theme_intro_seen_owner_insert · nex_theme_intro_seen_owner_read
--
-- 4 · Anon cannot read seen state:
-- SET ROLE anon;
-- SELECT COUNT(*) FROM nex_theme_intro_seen;
-- RESET ROLE;
-- -- expected: 0 (table is auth-only; no public read policy)
-- ============================================================================
