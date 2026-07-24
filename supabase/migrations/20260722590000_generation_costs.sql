-- Trade OS · Generation cost persistence + margin analytics view.
--
-- Every asset generation writes a row here so we can compute per-day
-- margin per Studio App per merchant. Downstream dashboards read from
-- v_generation_margin_by_day.

CREATE TABLE IF NOT EXISTS public.hammerex_generation_costs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug     TEXT,
  homeowner_id      UUID REFERENCES public.hammerex_homeowners(id) ON DELETE SET NULL,
  capability_slug   TEXT NOT NULL,          -- "vehicle.van-wrap" etc
  generation_id     UUID NOT NULL,           -- FK-loose so we can log without foreign gen row
  model_used        TEXT NOT NULL,
  usd_cost          NUMERIC(8,4) NOT NULL,   -- our AI cost
  pence_charged     INTEGER NOT NULL,        -- what merchant paid (converted from USD)
  quality_tier      TEXT NOT NULL DEFAULT 'medium',
  latency_ms        INTEGER,
  quality_score     INTEGER,
  cache_hit         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gen_costs_merchant_day
  ON public.hammerex_generation_costs (merchant_slug, created_at DESC)
  WHERE merchant_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_costs_capability
  ON public.hammerex_generation_costs (capability_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gen_costs_model
  ON public.hammerex_generation_costs (model_used, created_at DESC);

ALTER TABLE public.hammerex_generation_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gen_costs_owner_read ON public.hammerex_generation_costs;
CREATE POLICY gen_costs_owner_read
  ON public.hammerex_generation_costs
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
    OR (auth.jwt() ->> 'homeowner_id') IS NOT NULL
    AND homeowner_id::text = (auth.jwt() ->> 'homeowner_id')
  );

-- Margin view — total spent per merchant per Studio per day.
CREATE OR REPLACE VIEW public.v_generation_margin_by_day AS
SELECT
  merchant_slug,
  capability_slug,
  DATE(created_at)              AS day,
  COUNT(*)                      AS gens,
  SUM(usd_cost)::NUMERIC(10,4)  AS total_ai_usd,
  SUM(pence_charged)            AS total_charged_pence,
  ROUND(AVG(latency_ms))        AS avg_latency_ms,
  ROUND(AVG(quality_score))     AS avg_quality_score,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits
FROM public.hammerex_generation_costs
WHERE merchant_slug IS NOT NULL
GROUP BY merchant_slug, capability_slug, DATE(created_at);
