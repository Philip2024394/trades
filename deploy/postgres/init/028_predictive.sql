-- NEX Predictive Engine · §5.4
--
-- Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §14
-- v1.0 amendment 1.0.5 · invariant #15 (Prediction Is Not Execution)
--
-- Three additive tables:
--   nex.prediction_models · model registry · versions · active/inactive · calibration · rollback
--   nex.predictions       · INSERT-only · one row per (target, contact, model_version, run)
--   nex.predictive_controls · single-row global control (kill switch · confidence threshold)
--
-- The Predictive Engine READS canonical events / analytics rollups / attribution outputs
-- and WRITES only to these three tables. It never writes to compliance, contacts,
-- campaigns, journeys, experiments, attributions, conversion_events, delivery_jobs, or
-- provider tables. Any import from @/lib/nex/delivery/* or @/lib/nex/compliance/* inside
-- src/lib/nex/predictive/** is a doctrine violation.
--
-- Zero changes to any v1.0 table.

-- ── nex.prediction_models · registry + rollback ─────────────────────
CREATE TABLE IF NOT EXISTS nex.prediction_models (
  model_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target             TEXT NOT NULL,                                   -- 'conversion_probability' | 'send_time' | 'churn' | future targets
  model_version      TEXT NOT NULL,                                   -- semver-like · e.g. 'conv-prob@v0.1.0'
  model_kind         TEXT NOT NULL CHECK (model_kind IN ('linear_score','logistic','rules','random_forest','xgboost','neural','other')),
  status             TEXT NOT NULL DEFAULT 'shadow' CHECK (status IN ('shadow','active','retired')),
  feature_spec       JSONB NOT NULL DEFAULT '[]'::jsonb,              -- [{name,weight,description}]
  hyperparameters    JSONB NOT NULL DEFAULT '{}'::jsonb,
  calibration        JSONB NOT NULL DEFAULT '{}'::jsonb,              -- {brier,auc,samples,last_measured_at}
  training_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,              -- describes what the model was trained on
  deployed_at        TIMESTAMPTZ,                                     -- set when status→active
  retired_at         TIMESTAMPTZ,
  deployed_by        TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target, model_version)
);

-- Only one active version per target at a time (enforced via partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS prediction_models_one_active_per_target
  ON nex.prediction_models (target) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS prediction_models_target_status_idx ON nex.prediction_models (target, status);

-- ── nex.predictions · INSERT-only audit trail ───────────────────────
CREATE TABLE IF NOT EXISTS nex.predictions (
  prediction_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target             TEXT NOT NULL,                                   -- must match a prediction_models.target
  model_id           UUID NOT NULL REFERENCES nex.prediction_models(model_id),
  model_version      TEXT NOT NULL,                                   -- denormalised for fast querying + audit
  contact_id         UUID,                                            -- nullable for aggregate/segment predictions
  subject_kind       TEXT NOT NULL DEFAULT 'contact' CHECK (subject_kind IN ('contact','segment','campaign','journey','variant')),
  subject_id         TEXT,                                            -- generic subject reference (e.g. segment_id, campaign_id)
  prediction         JSONB NOT NULL,                                  -- {value, class?, rank?}
  confidence         NUMERIC(6, 5) NOT NULL DEFAULT 0,                -- 0..1
  input_snapshot     JSONB NOT NULL,                                  -- frozen feature vector + refs used at inference time
  reason             JSONB NOT NULL DEFAULT '[]'::jsonb,              -- top contributing features · [{feature,weight,contribution}]
  window_days        INT,                                             -- horizon of the prediction (for conversion probability)
  correlation_id     TEXT,                                            -- links to a downstream recommendation/command
  mode               TEXT NOT NULL DEFAULT 'recommendation' CHECK (mode IN ('recommendation','optimisation','shadow')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS predictions_target_created_idx  ON nex.predictions (target, created_at DESC);
CREATE INDEX IF NOT EXISTS predictions_contact_idx         ON nex.predictions (contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS predictions_subject_idx         ON nex.predictions (subject_kind, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS predictions_model_idx           ON nex.predictions (model_id, created_at DESC);

-- ── nex.predictive_controls · global kill switch ────────────────────
CREATE TABLE IF NOT EXISTS nex.predictive_controls (
  singleton              BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  paused                 BOOLEAN NOT NULL DEFAULT FALSE,              -- global kill switch: TRUE = no optimisation commands emitted
  paused_at              TIMESTAMPTZ,
  paused_by              TEXT,
  paused_reason          TEXT,
  confidence_threshold   NUMERIC(6, 5) NOT NULL DEFAULT 0.60,         -- minimum confidence for an optimisation command
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the singleton row on first install.
INSERT INTO nex.predictive_controls (singleton, paused, confidence_threshold)
VALUES (TRUE, FALSE, 0.60)
ON CONFLICT (singleton) DO NOTHING;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE nex.prediction_models     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.predictions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.predictive_controls   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='prediction_models' AND policyname='service_role_all_prediction_models') THEN
    CREATE POLICY "service_role_all_prediction_models" ON nex.prediction_models FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='predictions' AND policyname='service_role_all_predictions') THEN
    CREATE POLICY "service_role_all_predictions" ON nex.predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='nex' AND tablename='predictive_controls' AND policyname='service_role_all_predictive_controls') THEN
    CREATE POLICY "service_role_all_predictive_controls" ON nex.predictive_controls FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.prediction_models   IS 'Model registry · versioned · rollback via status flip · UNIQUE partial index enforces one active per target · invariant #15';
COMMENT ON TABLE nex.predictions         IS 'INSERT-only audit trail of every inference · every row carries model_version, input_snapshot, confidence, reason · invariant #15';
COMMENT ON TABLE nex.predictive_controls IS 'Singleton row · global pause / kill switch + confidence threshold · pause blocks optimisation commands without a redeploy · invariant #15';
