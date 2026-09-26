-- ============================================================================
-- NEX-native Migration 046 · nex_account.tier + bisnis_expires_at
-- ============================================================================
--
-- Purpose:
--   First schema step of the Indonesia package doctrine (sealed
--   2026-09-27 · see CLAUDE.md "Three tiers" section). Adds the
--   package tier the account subscribes to.
--
-- Model decision:
--   For MVP the tier lives on the ACCOUNT only. Every business
--   owned by an account inherits its owner's tier. This matches
--   how small Indonesian shops actually operate — one owner, one
--   subscription, possibly multiple stalls/kiosks. If a future
--   design requires per-business tiers (e.g., someone wants only
--   ONE of their businesses on Bisnis), add a
--   `nex_business.tier_override` column then. Not now.
--
-- Values (enum-by-CHECK):
--   · 'gratis' · free forever · default at signup
--   · 'bisnis' · paid tier · IDR 99k/month launch price
--   · 'pro'    · deferred phase 2 · defined but unused at launch
--
-- Subscription lifecycle:
--   bisnis_expires_at is null when never upgraded OR currently gratis.
--   When an admin/subscription/wallet promotes an account it sets:
--     tier = 'bisnis'
--     bisnis_expires_at = now() + interval (usually 30 days or 365)
--   Feature gates check both fields · code helper
--   `effectiveTier(account)` treats bisnis with a past expiry as
--   gratis (lazy downgrade · no scheduled job needed for MVP).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '046';
--     ALTER TABLE nex_account
--       DROP CONSTRAINT IF EXISTS nex_account_tier_known,
--       DROP COLUMN IF EXISTS bisnis_expires_at,
--       DROP COLUMN IF EXISTS tier;
--   COMMIT;
--   (Note · rolling back leaves any code checking `tier` broken.
--   Only roll back if the whole packaging plan is being reverted.)
-- ============================================================================

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'gratis';

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS bisnis_expires_at timestamptz;

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_tier_known CHECK (
    tier IN ('gratis', 'bisnis', 'pro')
  );

COMMENT ON COLUMN nex_account.tier IS
  'Package tier · gratis (default free-forever) | bisnis (paid launch tier) | pro (phase-2, deferred). Businesses inherit owner-account tier. See doctrine in CLAUDE.md sealed 2026-09-27.';

COMMENT ON COLUMN nex_account.bisnis_expires_at IS
  'Subscription lapse timestamp for Bisnis · null when never upgraded or currently gratis. Feature gates lazy-check now() < bisnis_expires_at before granting Bisnis features (via effectiveTier helper). No scheduled downgrade job needed.';

-- Index the expiry so admin-side "find expiring subscriptions this week"
-- queries stay cheap. Partial · only rows with a non-null expiry.
CREATE INDEX IF NOT EXISTS idx_nex_account_bisnis_expires_at
  ON nex_account (bisnis_expires_at)
  WHERE bisnis_expires_at IS NOT NULL;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '046',
    'nex_account.tier + bisnis_expires_at · Indonesia launch tier column',
    'Founder-authorised 2026-09-27. First step of package doctrine. Default gratis · CHECK constraint on three values. Businesses inherit owner tier for MVP · per-business tier override deferred.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_account' AND column_name IN ('tier','bisnis_expires_at');
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'nex_account'::regclass
--      AND conname = 'nex_account_tier_known';
--   SELECT * FROM nex_migration_history WHERE version = '046';
