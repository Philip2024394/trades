-- 048_alert_rules.sql
--
-- F5 · Alert-rule storage. Prior state (per operational audit): 12 rules
-- were hardcoded inside SystemHealthPanel.tsx — operators had to push code
-- to add/remove/tune one. This migration adds the table + minimal audit
-- so alerts become operator-editable data, not code.
--
-- SCHEMA
--   nex.alert_rules
--     rule_id (uuid) · counter_name (references observability counters)
--     comparison ('gt' | 'gte' | 'lt' | 'lte' | 'eq') · threshold
--     window_seconds (rolling window) · severity ('p0' | 'p1' | 'p2' | 'p3')
--     enabled (bool) · description · created_at / updated_at / disabled_at
--     channels (jsonb) — future: email/slack/pagerduty destination hints
--
-- Reversible: `DROP TABLE nex.alert_rules CASCADE`.

CREATE TABLE IF NOT EXISTS nex.alert_rules (
  rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_name    TEXT NOT NULL,
  comparison      TEXT NOT NULL CHECK (comparison IN ('gt', 'gte', 'lt', 'lte', 'eq')),
  threshold       NUMERIC NOT NULL,
  window_seconds  INTEGER NOT NULL CHECK (window_seconds > 0),
  severity        TEXT NOT NULL CHECK (severity IN ('p0', 'p1', 'p2', 'p3')),
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  description     TEXT,
  channels        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_counter_enabled
  ON nex.alert_rules (counter_name, enabled);

CREATE INDEX IF NOT EXISTS idx_alert_rules_severity
  ON nex.alert_rules (severity);

-- One-way ratchet: any row-level change updates updated_at automatically.
CREATE OR REPLACE FUNCTION nex.alert_rules_bump_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.enabled = FALSE AND OLD.enabled = TRUE THEN NEW.disabled_at = NOW(); END IF;
  IF NEW.enabled = TRUE  AND OLD.enabled = FALSE THEN NEW.disabled_at = NULL;  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alert_rules_bump ON nex.alert_rules;
CREATE TRIGGER trg_alert_rules_bump
  BEFORE UPDATE ON nex.alert_rules
  FOR EACH ROW EXECUTE FUNCTION nex.alert_rules_bump_updated_at();

-- RLS · service_role can do anything, other roles denied.
ALTER TABLE nex.alert_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='nex' AND tablename='alert_rules' AND policyname='service_role_all_alert_rules'
  ) THEN
    CREATE POLICY service_role_all_alert_rules
      ON nex.alert_rules FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.alert_rules IS
  'F5 · operator-editable alert rules. Consumed by the health dashboard + (future) alert dispatcher. Replaces hardcoded rules in SystemHealthPanel.tsx.';
