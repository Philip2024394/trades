-- NEX Operational Alerts · §5.10 · rule catalogue + lifecycle + immutable dispatch audit
--
-- Architecture (Philip 2026-08-08 · locked):
--   Monitoring → Alert Rules → Canonical system.health_alert event
--     → Alert Dispatcher → { Email · Webhook · Slack · future channels }
--
-- Dispatchers deliver already-evaluated alerts · they never contain
-- evaluation logic. Rules produce alerts · alerts fan out to enabled
-- channels · lifecycle (open → acknowledged → resolved) is tracked
-- separately from dispatch attempts.
--
-- Idempotent · additive-only.

-- ── nex.alert_rules · rule catalogue + enable/threshold config ────
CREATE TABLE IF NOT EXISTS nex.alert_rules (
  rule_id           TEXT PRIMARY KEY,                            -- stable slug e.g. 'queue_oldest_high'
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,                                -- 'queue' | 'workers' | 'providers' | 'compliance' | 'rates' | 'webhook' | 'limiter' | 'infra'
  severity          TEXT NOT NULL   CHECK (severity IN ('info','warning','critical')),
  description       TEXT,
  params            JSONB NOT NULL DEFAULT '{}'::jsonb,           -- thresholds live here so admins can tune without deploys
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  dedup_window_sec  INT NOT NULL DEFAULT 300,                      -- 5 min · re-dispatch only after this window
  notify_channels   TEXT[] NOT NULL DEFAULT ARRAY['email','webhook','slack']::TEXT[],
  root_cause_of     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],       -- if this rule fires, mark listed rules' alerts with same incident_id
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── nex.alerts · lifecycle-aware alert instances ─────────────────
CREATE TABLE IF NOT EXISTS nex.alerts (
  alert_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id            TEXT NOT NULL REFERENCES nex.alert_rules(rule_id) ON DELETE RESTRICT,
  incident_id        UUID,                                         -- self-id for root · shared with dependent alerts for correlation
  severity           TEXT NOT NULL,
  state              TEXT NOT NULL DEFAULT 'open'    CHECK (state IN ('open','acknowledged','resolved')),
  title              TEXT NOT NULL,
  detail             TEXT,
  snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,           -- the metrics that triggered the alert
  first_detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_count      INT NOT NULL DEFAULT 1,
  acknowledged_at    TIMESTAMPTZ,
  acknowledged_by    TEXT,
  resolved_at        TIMESTAMPTZ,
  resolved_reason    TEXT,
  resolved_by        TEXT
);

CREATE INDEX IF NOT EXISTS alerts_state_idx      ON nex.alerts (state, last_triggered_at DESC);
CREATE INDEX IF NOT EXISTS alerts_rule_state_idx ON nex.alerts (rule_id, state);
CREATE INDEX IF NOT EXISTS alerts_incident_idx   ON nex.alerts (incident_id) WHERE incident_id IS NOT NULL;

-- One open alert per rule at a time (any given rule can only have ONE
-- alert in `open` state). Prevents duplicate-open rows during evaluation
-- races. Acknowledged and resolved alerts are unconstrained (history).
CREATE UNIQUE INDEX IF NOT EXISTS alerts_one_open_per_rule
  ON nex.alerts (rule_id) WHERE state = 'open';

-- ── nex.alert_dispatches · immutable audit of every dispatch attempt ──
CREATE TABLE IF NOT EXISTS nex.alert_dispatches (
  dispatch_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID NOT NULL REFERENCES nex.alerts(alert_id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,           -- 'email' | 'webhook' | 'slack' | future
  destination     TEXT,                     -- recipient email · webhook URL · slack workspace hint (never leaks secrets fully)
  status          TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error           TEXT,
  latency_ms      INT,
  attempt_no      INT NOT NULL DEFAULT 1,
  dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS alert_dispatches_alert_idx ON nex.alert_dispatches (alert_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS alert_dispatches_time_idx  ON nex.alert_dispatches (dispatched_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.alert_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.alert_dispatches  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'alert_rules' AND policyname = 'service_role_all_alert_rules') THEN
    CREATE POLICY "service_role_all_alert_rules" ON nex.alert_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'alerts' AND policyname = 'service_role_all_alerts') THEN
    CREATE POLICY "service_role_all_alerts" ON nex.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'alert_dispatches' AND policyname = 'service_role_all_alert_dispatches') THEN
    CREATE POLICY "service_role_all_alert_dispatches" ON nex.alert_dispatches FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.alert_rules      IS 'Rule catalogue · admin-editable thresholds + enable flags · seeded on first evaluate';
COMMENT ON TABLE nex.alerts           IS 'Alert instances with lifecycle (open/acknowledged/resolved) · one open per rule · incident_id correlates related alerts';
COMMENT ON TABLE nex.alert_dispatches IS 'Immutable audit of every notification attempt · never mutated after insert';
