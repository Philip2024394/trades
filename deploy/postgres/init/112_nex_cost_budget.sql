-- 112_nex_cost_budget.sql
--
-- NEX Cost Budget · Discovery Fabric P8 · Foundation C.
-- Philip 2026-08-26 · design spec at docs/nex-fabric/02-provider-abstraction-router-failure.md
--
-- Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
--
-- Why this exists (earned): today NEX has zero cost governance. If we enable a
-- paid provider (google-places · Foursquare · etc) tomorrow, an infinite-loop
-- bug or misconfigured cadence could spend hundreds of dollars in an hour.
-- One row per BRANCH (food · accommodation · market · transport) with a hard
-- daily cap. Cost oracle checks before every provider call, records after,
-- opens circuit at cap. Cap can be raised operationally, never bypassed.
--
-- P8 scope: table + 4 seed rows. Cost oracle helper lives at
-- scripts/nex-worker/cost-oracle.mjs. No walker integration yet · that lands
-- once google-places (or another paid provider) is actually wired.
--
-- Additive · reversible · seed rows guarded with ON CONFLICT DO NOTHING.
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.cost_budget;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.cost_budget (
  branch                text PRIMARY KEY,             -- 'food' | 'accommodation' | 'market' | 'transport'
  daily_cap_usd         numeric(10,4) NOT NULL,
  spent_today_usd       numeric(10,6) NOT NULL DEFAULT 0,
  last_reset_at         timestamptz   NOT NULL DEFAULT now(),
  circuit_open_at       timestamptz,                  -- set when spent >= cap
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex.cost_budget IS
  'NEX Discovery Fabric P8 · per-branch daily cost cap. Consumed by scripts/nex-worker/cost-oracle.mjs. checkBudget before calls, recordSpend after, resetDailyIfNeeded at cycle start. Cap can be raised operationally · never bypassed.';

COMMENT ON COLUMN nex.cost_budget.daily_cap_usd IS
  'Hard daily ceiling. When spent_today_usd >= this, circuit_open_at is set and cost-oracle returns allowed=false for the rest of the day.';

COMMENT ON COLUMN nex.cost_budget.spent_today_usd IS
  'Rolling total for the current day. Reset by resetDailyIfNeeded at cycle start when last_reset_at is stale.';

COMMENT ON COLUMN nex.cost_budget.circuit_open_at IS
  'Timestamp when the daily cap was first breached today. Cleared when the daily reset runs. Read by cost-oracle to short-circuit further checks.';

-- Seed one row per branch · conservative $10/day cap. Philip raises after evidence.
INSERT INTO nex.cost_budget (branch, daily_cap_usd, notes) VALUES
  ('food',          10.0000, 'P8 conservative starting cap · raise after telemetry proves need'),
  ('accommodation', 10.0000, 'P8 conservative starting cap · raise after telemetry proves need'),
  ('market',        10.0000, 'P8 conservative starting cap · raise after telemetry proves need'),
  ('transport',     10.0000, 'P8 conservative starting cap · raise after telemetry proves need')
ON CONFLICT (branch) DO NOTHING;

-- Sanity check.
DO $$
DECLARE
  seed_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='cost_budget'
  ) THEN
    RAISE EXCEPTION 'Migration 112 failed: nex.cost_budget not created';
  END IF;

  SELECT COUNT(*) INTO seed_count FROM nex.cost_budget
    WHERE branch IN ('food','accommodation','market','transport');
  IF seed_count < 4 THEN
    RAISE EXCEPTION 'Migration 112 failed: expected 4 seed rows, found %', seed_count;
  END IF;

  RAISE NOTICE 'Migration 112 complete · % seed branches', seed_count;
END $$;

COMMIT;
