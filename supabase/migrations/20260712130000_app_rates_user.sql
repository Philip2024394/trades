-- app_rates_submissions + app_rates_aggregates — verified user rates.
--
-- Phase 3 of the evidence-or-silence rates system
-- (project_evidence_or_silence.md).
--
-- User submissions become a displayable "verified market signal"
-- ONLY if all four thresholds are met:
--   1. ≥3 independent VTI-verified contributors
--   2. within a rolling 3-month window
--   3. standard deviation < 15% of median (signal not too noisy)
--   4. no single contributor represents >40% of submissions
--
-- Sanity clamps:
--   • Auto-reject rates outside 30-200% of the ONS baseline
--     (obvious garbage catcher, prevents typos and spam)
--   • One submission per trade × region × rate_type per month
--     (prevents ballot stuffing)
--   • 24-hour cooldown before submission enters aggregate
--     (fraud review window)
--
-- Contributor identity is stored server-side but NEVER exposed on
-- displayed aggregates. Rates show sample size and contributor count,
-- not names.

CREATE TABLE IF NOT EXISTS app_rates_submissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_slug        text NOT NULL,          -- SOC-mapped internal slug
  region_code       text NOT NULL,          -- NUTS-1 region
  rate_type         text NOT NULL CHECK (rate_type IN ('hourly','daily','annual')),
  gbp_amount        numeric(10,2) NOT NULL CHECK (gbp_amount > 0),
  date_of_work      date NOT NULL,
  source_type       text NOT NULL CHECK (source_type IN ('invoice','quote','hourly-rate','day-rate','contract')),
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  -- 24-hour cool-down: submissions become 'approved' after review
  -- window has passed with no flags. Aggregates only read approved
  -- rows.
  approved          boolean NOT NULL DEFAULT false,
  approved_at       timestamptz,
  -- Flag for fraud review — if set the row is excluded from aggregates
  -- and returned only in admin dashboards.
  flagged           boolean NOT NULL DEFAULT false,
  flag_reason       text,
  UNIQUE (trade_id, trade_slug, region_code, rate_type, date_trunc('month', date_of_work))
);

CREATE INDEX IF NOT EXISTS app_rates_submissions_lookup_idx
  ON app_rates_submissions (trade_slug, region_code, rate_type, submitted_at DESC)
  WHERE approved = true AND flagged = false;

CREATE INDEX IF NOT EXISTS app_rates_submissions_pending_idx
  ON app_rates_submissions (submitted_at)
  WHERE approved = false AND flagged = false;

-- Row-level security: contributors can INSERT their own rows and READ
-- their own history. Reading aggregates goes through the aggregates
-- table (public), never through raw submissions.
ALTER TABLE app_rates_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_owner_read" ON app_rates_submissions;
CREATE POLICY "submissions_owner_read"
  ON app_rates_submissions
  FOR SELECT
  USING (auth.uid() = trade_id);

DROP POLICY IF EXISTS "submissions_owner_insert" ON app_rates_submissions;
CREATE POLICY "submissions_owner_insert"
  ON app_rates_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = trade_id);

-- Never allow contributors to UPDATE/DELETE their submissions after
-- posting (audit trail integrity — otherwise a contributor could
-- retroactively edit their rate to game aggregates).

-- ─── Aggregates — the ONLY table the display layer reads from ────

CREATE TABLE IF NOT EXISTS app_rates_aggregates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_slug        text NOT NULL,
  region_code       text NOT NULL,
  rate_type         text NOT NULL CHECK (rate_type IN ('hourly','daily','annual')),
  window_start      date NOT NULL,          -- rolling 3-month window start
  window_end        date NOT NULL,          -- rolling 3-month window end
  sample_size       integer NOT NULL CHECK (sample_size >= 3),
  contributor_count integer NOT NULL CHECK (contributor_count >= 3),
  gbp_median        numeric(10,2) NOT NULL,
  gbp_p25           numeric(10,2) NOT NULL,
  gbp_p75           numeric(10,2) NOT NULL,
  stdev_pct         numeric(5,2) NOT NULL CHECK (stdev_pct < 15.0),
  computed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_slug, region_code, rate_type, window_end)
);

CREATE INDEX IF NOT EXISTS app_rates_aggregates_lookup_idx
  ON app_rates_aggregates (trade_slug, region_code, rate_type, window_end DESC);

-- Aggregates are publicly readable. Written by the nightly
-- aggregation job (service role only).
ALTER TABLE app_rates_aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aggregates_public_read" ON app_rates_aggregates;
CREATE POLICY "aggregates_public_read"
  ON app_rates_aggregates
  FOR SELECT
  USING (true);

COMMENT ON TABLE app_rates_submissions IS
  'Raw user-contributed rate observations. Never displayed directly. Aggregated by scheduled job into app_rates_aggregates once thresholds met.';
COMMENT ON TABLE app_rates_aggregates IS
  'Computed verified market signals. Only rows meeting the 3+/3-month/<15% stdev rule land here. Public read; UI reads exclusively from this table for "verified market" claims.';
COMMENT ON COLUMN app_rates_aggregates.stdev_pct IS
  'Standard deviation as % of median. CHECK constraint enforces < 15% so noisy aggregates never persist.';
