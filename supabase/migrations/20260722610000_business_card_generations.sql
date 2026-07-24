-- Business Card Studio · generations table. Follows doc checklist:
-- table + RLS enabled + owner policy.

CREATE TABLE IF NOT EXISTS public.hammerex_business_card_generations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug      TEXT,
  brand_snapshot_id  UUID REFERENCES public.hammerex_brand_snapshots(id) ON DELETE SET NULL,
  prompt_text        TEXT NOT NULL,
  image_urls         JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_used         TEXT,
  usd_cost           NUMERIC(6,4),
  latency_ms         INTEGER,
  quality_score      INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_card_merchant
  ON public.hammerex_business_card_generations (merchant_slug, created_at DESC)
  WHERE merchant_slug IS NOT NULL;

ALTER TABLE public.hammerex_business_card_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_card_owner_read ON public.hammerex_business_card_generations;
CREATE POLICY business_card_owner_read
  ON public.hammerex_business_card_generations
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'merchant_slug') IS NOT NULL
    AND merchant_slug = (auth.jwt() ->> 'merchant_slug')
  );
