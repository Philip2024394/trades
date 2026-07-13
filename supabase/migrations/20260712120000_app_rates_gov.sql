-- app_rates_gov — government-sourced rate baselines.
--
-- Evidence-or-silence rule (project_evidence_or_silence.md) requires
-- that every displayed rate has a provable source. This table holds
-- rates ingested from official public data:
--
--   • ONS ASHE — Annual Survey of Hours and Earnings, by SOC 2020
--     occupation code and NUTS-1 region (published quarterly, OGL v3)
--     https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkingtime
--
--   • CITB Skills Network — construction-specific rates by trade
--     (annual, freely publishable with citation)
--     https://www.citb.co.uk/about-citb/skills-network/
--
--   • HMRC PAYE RTI — real-time PAYE median earnings by industry code
--     (quarterly public summaries)
--     https://www.gov.uk/government/statistics/paye-real-time-information-rti
--
-- Every row carries `source`, `source_url` and `source_release` so
-- the UI can render "✓ Official — ONS ASHE Q2 2026 · View source"
-- and let any user click through to the raw dataset.
--
-- Ingest is scheduled weekly; releases from ONS are quarterly so we
-- run 4× more often than necessary to catch corrections.

CREATE TABLE IF NOT EXISTS app_rates_gov (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text NOT NULL CHECK (source IN ('ONS_ASHE', 'CITB_SKILLS', 'HMRC_PAYE')),
  source_url        text NOT NULL,
  source_release    text NOT NULL,           -- 'Q2 2026' | 'Annual 2025' etc.
  trade_soc_code    text NOT NULL,           -- SOC 2020 4-digit code
  trade_slug        text NOT NULL,           -- our internal taxonomy slug
  region_code       text NOT NULL,           -- NUTS-1 region (e.g. 'UKD')
  region_label      text NOT NULL,           -- human label ('North West')
  rate_type         text NOT NULL CHECK (rate_type IN ('hourly','daily','annual')),
  gbp_low           numeric(10,2),           -- 25th percentile
  gbp_median        numeric(10,2) NOT NULL,  -- 50th percentile (required)
  gbp_high          numeric(10,2),           -- 75th percentile
  sample_size_note  text,                    -- e.g. 'based on 4,200 PAYE returns'
  released_at       date NOT NULL,           -- when the source published
  ingested_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, trade_soc_code, region_code, rate_type, source_release)
);

-- Query index for the primary UI lookup: "rates for this trade in
-- this region". Sorted by released_at DESC so latest-per-slug wins.
CREATE INDEX IF NOT EXISTS app_rates_gov_lookup_idx
  ON app_rates_gov (trade_slug, region_code, rate_type, released_at DESC);

-- Health-check query support: last successful ingest per source.
CREATE INDEX IF NOT EXISTS app_rates_gov_source_idx
  ON app_rates_gov (source, ingested_at DESC);

-- RLS: publicly readable (this IS public data, republishing is the
-- point). Writes are service-role only (only the ingest job writes).
ALTER TABLE app_rates_gov ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rates_gov_public_read" ON app_rates_gov;
CREATE POLICY "rates_gov_public_read"
  ON app_rates_gov
  FOR SELECT
  USING (true);

COMMENT ON TABLE app_rates_gov IS
  'Government-sourced rate baselines. Every row has provenance (source, source_url, source_release) so the UI can prove where the number came from. Written by scheduled ingest jobs only; publicly readable.';
COMMENT ON COLUMN app_rates_gov.source IS
  'ONS_ASHE = Annual Survey of Hours and Earnings (quarterly). CITB_SKILLS = CITB Skills Network annual report. HMRC_PAYE = HMRC PAYE Real Time Information quarterly.';
COMMENT ON COLUMN app_rates_gov.trade_soc_code IS
  'SOC 2020 occupation code, e.g. 5322 for Plasterers, 5312 for Bricklayers.';
COMMENT ON COLUMN app_rates_gov.region_code IS
  'NUTS-1 region code (UKC = North East, UKD = North West, UKE = Yorkshire and Humber, UKF = East Midlands, UKG = West Midlands, UKH = East, UKI = London, UKJ = South East, UKK = South West, UKL = Wales, UKM = Scotland, UKN = Northern Ireland).';
