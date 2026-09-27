-- ============================================================================
-- NEX-native Migration 063 · Bridge 13 · Seller responsiveness signals
-- ============================================================================
--
-- Adds the columns that power the graduated seller-activity model:
--
--   last_seller_activity_at  timestamptz  the last time the seller
--                                          "did something" · sending a
--                                          peer message, editing a
--                                          product, updating the shop
--   is_away                  boolean      manual vacation mode toggle
--   away_until               timestamptz  optional auto-return date
--   away_message             text         short "Back on 5 October"
--                                          copy shown on the shop
--   archived_at              timestamptz  set when the shop crosses
--                                          the 30-day inactivity floor
--                                          · unset when the seller
--                                          reactivates
--
-- The service layer computes a status from these:
--   'active'    · replied to something in the last 24h
--   'slow'      · 24h → 7d since last activity
--   'away'      · is_away=true (manual) OR > 7d inactive (automatic)
--   'archived'  · archived_at IS NOT NULL OR > 30d inactive
--
-- Archived shops disappear from Directory search until the seller
-- signs in again · listings and chat threads stay intact.
--
-- Backfill:
--   last_seller_activity_at = COALESCE(updated_at, created_at, now())
--   so existing shops are treated as active as of migration time,
--   not immediately marked stale.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '063';
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS last_seller_activity_at,
--       DROP COLUMN IF EXISTS is_away,
--       DROP COLUMN IF EXISTS away_until,
--       DROP COLUMN IF EXISTS away_message,
--       DROP COLUMN IF EXISTS archived_at;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS last_seller_activity_at timestamptz
    NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_away boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS away_until timestamptz,
  ADD COLUMN IF NOT EXISTS away_message text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill existing rows to their most recent known activity.
UPDATE nex_business
   SET last_seller_activity_at = COALESCE(updated_at, created_at, now())
 WHERE last_seller_activity_at IS NULL OR last_seller_activity_at = now();

-- Index for quick "who's active" queries in the Directory.
CREATE INDEX IF NOT EXISTS idx_nex_business_activity_at
  ON nex_business (last_seller_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_business_archived_at
  ON nex_business (archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN nex_business.last_seller_activity_at IS
  'When the owner last did something on this shop · driving the
   graduated activity signal (active/slow/away/archived). Bumped by
   the sendPeerMessage service, product edits, and shop updates.
   Sealed 2026-09-28 · Bridge 13.';
COMMENT ON COLUMN nex_business.is_away IS
  'Manual vacation mode · when true the shop shows the away badge
   regardless of last_seller_activity_at.';
COMMENT ON COLUMN nex_business.away_until IS
  'Optional auto-return date · surfaces as "Back on 5 Oct" copy on
   the shop landing when in the future.';
COMMENT ON COLUMN nex_business.away_message IS
  'Optional short message the seller wants buyers to see while away.';
COMMENT ON COLUMN nex_business.archived_at IS
  'Set when a shop crosses the 30-day inactivity floor · archived
   shops are hidden from Directory search until reactivated.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '063',
    'Bridge 13 · seller responsiveness columns · last_activity, is_away, away_until, away_message, archived_at',
    'Founder-authorised 2026-09-28. Prevents NEX from becoming a graveyard of dormant accounts · surfaces honest activity signals on every shop.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT slug, last_seller_activity_at, is_away, archived_at
--     FROM nex_business WHERE slug = 'aisha-vintage-cameras';
