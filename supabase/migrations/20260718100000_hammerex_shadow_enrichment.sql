-- Shadow-profile enrichment tracking (2026-07-18).
--
-- Adds columns for tracking Google Places + website enrichment
-- attempts. Companies House scraper builds the profile skeleton;
-- enrichment cron cross-references Google + follows the website
-- to find email/phone/website.
--
-- After 3 failed attempts the merchant is auto-released (unreachable)
-- to avoid infinite retry loops on businesses with no online presence.

ALTER TABLE public.hammerex_shadow_merchants
  ADD COLUMN IF NOT EXISTS enriched_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_source     TEXT;    -- 'google_places' | 'website' | 'none'

-- Index for the enrich cron's queue query — find rows without email
-- that need another attempt.
CREATE INDEX IF NOT EXISTS idx_shadow_merchants_enrichment_queue
  ON public.hammerex_shadow_merchants (enrichment_attempts, enriched_at)
  WHERE email IS NULL AND status IN ('scraped','queued') AND enrichment_attempts < 3;
