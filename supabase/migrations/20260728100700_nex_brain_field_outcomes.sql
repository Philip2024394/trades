-- 20260728100700_nex_brain_field_outcomes.sql
-- Living Trade Brains · Field Outcome Tracking · ADR-0037
--
-- SCHEMA ONLY in Phase 1. Learning logic ships in Phase 2 (Decision
-- Engine). We lay the schema now so no future migration is needed.
--
-- Every real-world outcome that can be tied back to a Brain answer
-- writes a row here. Enables:
--   · Confidence adjustment (ADR-0017 §8): "estimator delta >12% over 90
--     days → labour hours adjusted"
--   · Field learning loop: prediction vs actual · duration variance ·
--     cost variance · customer satisfaction per Brain × merchant × region
--   · Quarterly author review · surface patterns to certified authors

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_field_outcomes (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_answer_id        uuid          NULL
                                       REFERENCES public.hammerex_nex_brain_answers(id)
                                       ON DELETE SET NULL,
  brain_slug             text          NOT NULL
                                       REFERENCES public.hammerex_nex_brains(slug)
                                       ON DELETE RESTRICT,
  brain_version_id       uuid          NOT NULL
                                       REFERENCES public.hammerex_nex_brain_versions(id)
                                       ON DELETE RESTRICT,
  outcome_kind           text          NOT NULL,
  -- prediction_vs_actual · duration_variance · cost_variance
  -- · customer_satisfaction · defect_rate · rework_required
  predicted_value_json   jsonb         NULL,
  actual_value_json      jsonb         NULL,
  variance_json          jsonb         NULL,
  -- computed delta { absolute, percent, ... }
  correct                boolean       NULL,
  -- categorical outcome where applicable
  confidence_before      numeric(5,4)  NULL,
  confidence_after       numeric(5,4)  NULL,
  -- populated when Decision Engine adjusts confidence
  merchant_slug          text          NULL,
  region_code            text          NULL,
  reported_by            text          NULL,
  reported_at            timestamptz   NOT NULL DEFAULT now(),
  processed_at           timestamptz   NULL,
  -- when the learning loop picked this up (Phase 2)
  metadata               jsonb         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_brain_outcomes_brain
  ON public.hammerex_nex_brain_field_outcomes (brain_slug, reported_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_outcomes_answer
  ON public.hammerex_nex_brain_field_outcomes (brain_answer_id)
  WHERE brain_answer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_brain_outcomes_unprocessed
  ON public.hammerex_nex_brain_field_outcomes (reported_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_brain_outcomes_merchant_region
  ON public.hammerex_nex_brain_field_outcomes (brain_slug, merchant_slug, region_code)
  WHERE merchant_slug IS NOT NULL;

ALTER TABLE public.hammerex_nex_brain_field_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_field_outcomes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_all" ON public.hammerex_nex_brain_field_outcomes
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.hammerex_nex_brain_field_outcomes IS
  'Living Trade Brains · Field Outcome Tracking · ADR-0037 · schema in Phase 1 · learning logic in Phase 2';
