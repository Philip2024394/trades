-- Free-tier slug expiry — supports the 30-day activity policy.
--
-- Policy: free-tier merchants keep their slug as long as they log in
-- at least once every 30 days. After 30 days of inactivity the slug
-- is released back to the pool. Paid tiers are never affected.
--
-- Fields added to hammerex_trade_off_listings:
--   last_login_at             When the merchant last authenticated
--   slug_expiry_warning_at    When we last sent them a warning email
--   slug_expiry_stage         'ok' | 'warn-15' | 'warn-25' | 'warn-29' | 'expired'
--
-- The cron endpoint (/api/cron/free-slug-expiry) walks free-tier rows,
-- flips stages + fires warning emails, and finally archives the slug
-- on stage → expired. The archive is soft — we rename the slug to
-- 'archived-<uuid>' rather than deleting the row so re-registration
-- of the original slug is possible without FK gymnastics.

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slug_expiry_warning_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slug_expiry_stage TEXT
    NOT NULL DEFAULT 'ok'
    CHECK (slug_expiry_stage IN ('ok', 'warn-15', 'warn-25', 'warn-29', 'expired'));

-- Hot-path index for the cron: find rows that need action.
CREATE INDEX IF NOT EXISTS hammerex_listings_slug_expiry_idx
  ON hammerex_trade_off_listings (slug_expiry_stage, last_login_at)
  WHERE tier = 'standard'
    AND slug_expiry_stage != 'expired';

-- Backfill: rows without last_login_at get set to created_at so the
-- cron doesn't immediately expire every existing free account on
-- first run. Existing users get a full fresh 30-day window from now
-- to log in and reset their clock.
UPDATE hammerex_trade_off_listings
SET last_login_at = NOW()
WHERE last_login_at IS NULL;
