-- NEX Infrastructure Runtime · §5.7 · automation_rules + automation_runs
-- rules: forever (append-only versioning). runs: 180 days.

CREATE TABLE IF NOT EXISTS nex.automation_rules (
  snapshot_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id              TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  authority            TEXT NOT NULL CHECK (authority IN ('L1', 'L2', 'L3')),
  enabled              BOOLEAN NOT NULL,
  trigger              JSONB NOT NULL DEFAULT '{}'::jsonb,
  condition            JSONB NOT NULL DEFAULT '{}'::jsonb,
  action               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL,
  created_by           TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_rules_rule_id_idx    ON nex.automation_rules (rule_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS automation_rules_enabled_idx    ON nex.automation_rules (enabled, updated_at DESC);
CREATE INDEX IF NOT EXISTS automation_rules_authority_idx  ON nex.automation_rules (authority);
CREATE INDEX IF NOT EXISTS automation_rules_business_idx   ON nex.automation_rules (business_id, updated_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.automation_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'automation_rules' AND policyname = 'service_role_all_arules') THEN
    CREATE POLICY "service_role_all_arules" ON nex.automation_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.automation_rules IS 'Infrastructure Runtime §5.7 · Automation Engine rules · retention forever';

CREATE TABLE IF NOT EXISTS nex.automation_runs (
  run_id                    UUID PRIMARY KEY,
  rule_id                   TEXT NOT NULL,
  rule_name                 TEXT,
  rule_authority            TEXT,
  triggered_by_event_id     UUID,
  triggered_by_event_type   TEXT,
  triggered_at              TIMESTAMPTZ NOT NULL,
  status                    TEXT NOT NULL,
  outcome_detail            TEXT,
  action_snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_actor               TEXT,
  admin_decided_at          TIMESTAMPTZ,
  business_id               UUID,
  inserted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_runs_rule_ts_idx      ON nex.automation_runs (rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_status_ts_idx    ON nex.automation_runs (status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_trigger_evt_idx  ON nex.automation_runs (triggered_by_event_id) WHERE triggered_by_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS automation_runs_business_idx     ON nex.automation_runs (business_id, triggered_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.automation_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'automation_runs' AND policyname = 'service_role_all_aruns') THEN
    CREATE POLICY "service_role_all_aruns" ON nex.automation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.automation_runs IS 'Infrastructure Runtime §5.7 · Automation Engine runs · 180d retention';
