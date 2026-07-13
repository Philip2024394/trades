-- Add city-level granularity to the rates system.
--
-- Rates vary meaningfully at three levels: UK baseline, NUTS-1 region
-- (12 buckets), and individual city (20-30 buckets). London rates
-- differ from Manchester rates even though both regions have a
-- median. Trades want to see the city-specific number when available.
--
-- Design:
--   • Both submissions and aggregates gain an OPTIONAL city_slug
--   • Aggregation computes rows at BOTH levels — with city_slug set
--     (city aggregate) AND with city_slug NULL (region aggregate)
--   • The display layer prefers city over region, falls back to
--     region when no city aggregate exists — evidence-or-silence
--     rule still applies at each level

ALTER TABLE app_rates_submissions
  ADD COLUMN IF NOT EXISTS city_slug text;

CREATE INDEX IF NOT EXISTS app_rates_submissions_city_lookup_idx
  ON app_rates_submissions (trade_slug, city_slug, rate_type)
  WHERE approved = true AND flagged = false AND city_slug IS NOT NULL;

ALTER TABLE app_rates_aggregates
  ADD COLUMN IF NOT EXISTS city_slug text;

-- Drop the old unique constraint that ignored city, add one that
-- treats city_slug as part of the identity. Using coalesce so
-- (region-level) NULL city_slug rows still get unique enforcement.
ALTER TABLE app_rates_aggregates
  DROP CONSTRAINT IF EXISTS app_rates_aggregates_trade_slug_region_code_rate_type_window_e_key;

CREATE UNIQUE INDEX IF NOT EXISTS app_rates_aggregates_bucket_uniq
  ON app_rates_aggregates (
    trade_slug,
    region_code,
    coalesce(city_slug, ''),
    rate_type,
    window_end
  );

CREATE INDEX IF NOT EXISTS app_rates_aggregates_city_lookup_idx
  ON app_rates_aggregates (trade_slug, city_slug, rate_type, window_end DESC)
  WHERE city_slug IS NOT NULL;

COMMENT ON COLUMN app_rates_submissions.city_slug IS
  'Optional city bucket (e.g. ''manchester'', ''bristol''). NULL when the contributor left it unset — those submissions only contribute to the region-level aggregate.';
COMMENT ON COLUMN app_rates_aggregates.city_slug IS
  'When set, this row is a city-level aggregate. When NULL, this row is a region-level aggregate (all submissions in the region regardless of city).';
