-- Add per-service granularity to the rates system.
--
-- Motivation: hourly / daily / annual rates were too coarse.
-- "Plasterer £18/hr" is a benchmark but not actionable.
-- "Skim coat 2-coat prepared: £22/sqm median across 14 verified trades
-- in Manchester" IS actionable — and it's what buyers actually compare.
--
-- Design:
--   • Both submissions and aggregates gain an OPTIONAL service_slug
--   • When set, the row is a per-service rate (e.g. 'skim-2coat-prepared')
--   • When NULL, the row is the legacy hourly / daily / annual rate
--   • Aggregation now buckets on (trade × region × city × service × rate_type)
--   • Trades save their menu by submitting many rows at once (one per service)

ALTER TABLE app_rates_submissions
  ADD COLUMN IF NOT EXISTS service_slug text;

CREATE INDEX IF NOT EXISTS app_rates_submissions_service_lookup_idx
  ON app_rates_submissions (trade_slug, service_slug, region_code, city_slug, rate_type)
  WHERE approved = true AND flagged = false AND service_slug IS NOT NULL;

-- source_type gains a new value for menu-published rates. Menu rates
-- count in aggregation just like job rates — a rate a trade publishes
-- is a rate they're committing to, so it belongs in the market signal.
ALTER TABLE app_rates_submissions
  DROP CONSTRAINT IF EXISTS app_rates_submissions_source_type_check;

ALTER TABLE app_rates_submissions
  ADD CONSTRAINT app_rates_submissions_source_type_check
    CHECK (source_type IN ('invoice','quote','hourly-rate','day-rate','contract','menu-rate'));

-- Unique constraint update: one submission per (trade × service_slug × month)
-- OR the legacy (trade × rate_type × month) when service_slug is NULL.
-- Split into two partial indexes so both cases enforce uniqueness.
ALTER TABLE app_rates_submissions
  DROP CONSTRAINT IF EXISTS app_rates_submissions_trade_id_trade_slug_region_code_rate_t_key;

CREATE UNIQUE INDEX IF NOT EXISTS app_rates_submissions_uniq_service
  ON app_rates_submissions (
    trade_id,
    trade_slug,
    service_slug,
    coalesce(city_slug, region_code),
    date_trunc('month', date_of_work)
  )
  WHERE service_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_rates_submissions_uniq_rate_type
  ON app_rates_submissions (
    trade_id,
    trade_slug,
    region_code,
    rate_type,
    date_trunc('month', date_of_work)
  )
  WHERE service_slug IS NULL;

-- Aggregates also gain service_slug. Unique constraint extended to include it.
ALTER TABLE app_rates_aggregates
  ADD COLUMN IF NOT EXISTS service_slug text;

DROP INDEX IF EXISTS app_rates_aggregates_bucket_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS app_rates_aggregates_bucket_uniq
  ON app_rates_aggregates (
    trade_slug,
    region_code,
    coalesce(city_slug, ''),
    coalesce(service_slug, ''),
    rate_type,
    window_end
  );

CREATE INDEX IF NOT EXISTS app_rates_aggregates_service_lookup_idx
  ON app_rates_aggregates (trade_slug, service_slug, city_slug, rate_type, window_end DESC)
  WHERE service_slug IS NOT NULL;

COMMENT ON COLUMN app_rates_submissions.service_slug IS
  'Optional: specific service catalog slug (e.g. skim-2coat-prepared). When set, this row contributes to per-service aggregates. When NULL, it is a legacy hourly / daily / annual submission.';
COMMENT ON COLUMN app_rates_submissions.source_type IS
  'invoice/quote = past job. hourly-rate/day-rate/contract = standing rate. menu-rate = rate published in the trade service menu (still counts in market signal).';
COMMENT ON COLUMN app_rates_aggregates.service_slug IS
  'When set, aggregate is per specific service (e.g. skim coat 2-coat). When NULL, aggregate is per rate_type (hourly, daily, annual).';
