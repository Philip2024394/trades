-- ============================================================================
-- NEX-native Migration 029 · nex_live_post · Live phase 1 (announcements)
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 13a · opens the "Live" sealed keypad capability with an
--   HONEST phase-1 shape: business-anchored short-lived announcements.
--   The sealed doctrine for Live requires geo-boundary + eligibility +
--   expiry + moderation. This migration ships EXPIRY only · geo-boundary
--   and eligibility are explicitly deferred to phase 2.
--
--   Schema:
--     · id           · UUID PK
--     · business_id  · FK to nex_business(id) ON DELETE CASCADE
--     · body         · text NOT NULL · CHECK length 1..280 (short-form)
--     · expires_at   · timestamptz nullable · null = no explicit expiry ·
--                      consumers filter past-expiry at read time
--     · created_at   · timestamptz NOT NULL default now()
--
-- Doctrine notes:
--   · Founder sealed Live as local-relevance · NOT global TikTok · phase-2
--     work MUST add geo boundary + moderation before Live tile can claim
--     "geo-relevant feed" behaviour. Phase 1 is labelled honestly on the
--     public page as "business-anchored announcements · geo phase 2 to come".
--   · No moderation UI in phase 1 · service-role-only writes via caller
--     ownership check at the action layer.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '029';
--     DROP TABLE IF EXISTS nex_live_post;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_live_post (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  body        text NOT NULL,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_live_post_body_length CHECK (char_length(body) BETWEEN 1 AND 280)
);

COMMENT ON TABLE nex_live_post IS
  'Live phase-1 · business-anchored announcements · body ≤280 · optional expiry · consumers filter past-expiry at read time · geo-boundary + moderation are phase-2 work per sealed doctrine.';

CREATE INDEX IF NOT EXISTS idx_nex_live_post_business
  ON nex_live_post (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_live_post_created
  ON nex_live_post (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_live_post_expires
  ON nex_live_post (expires_at);
-- Note: partial index using now() is not supported (must be IMMUTABLE).
-- Consumers filter past-expiry at read time using expires_at IS NULL OR expires_at > now().
-- The two indexes above are sufficient for both the global feed (created_at DESC) and
-- the expiry-aware filter path.

ALTER TABLE nex_live_post ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '029',
    'nex_live_post · Live phase-1 announcements · business-anchored · ≤280 · optional expiry',
    'Wave B Slice 13a · Founder-authorised keypad build 2026-09-24. Phase 1 EXPLICITLY DEFERS geo-boundary + moderation per sealed doctrine. UI must label the surface honestly.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply:
--   SELECT tablename FROM pg_tables WHERE tablename = 'nex_live_post';
--   SELECT conname FROM pg_constraint WHERE conrelid = 'nex_live_post'::regclass;
