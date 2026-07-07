-- G5 · Trade insights + vision preprocessing metadata.
--
-- trade_insights aggregates anonymised signals across all merchants
-- of the same trade so the composer can inject "for roofers on
-- Instagram, high-engagement posts typically…" context into every
-- prompt. Regenerated weekly.
--
-- vision_preprocess_records stores the AI's understanding of each
-- uploaded photo before it becomes a business event — quality score,
-- detected faces (blurred), detected competitor brands, subject tags.

BEGIN;

CREATE TABLE IF NOT EXISTS trade_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  channel text,
    -- NULL = across all channels; otherwise per-channel insight
  insight_kind text NOT NULL,
    -- 'best_time_slots' | 'top_caption_length' | 'top_material_mentions'
    -- | 'typical_engagement_baseline' | 'seasonal_pattern' | ...
  facets jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_size int NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trade_insights_unique_key
  ON trade_insights (trade, COALESCE(channel, ''), insight_kind);
CREATE INDEX IF NOT EXISTS trade_insights_trade_channel_idx
  ON trade_insights (trade, channel, insight_kind);

CREATE OR REPLACE FUNCTION trade_insights_touch_updated()
  RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trade_insights_touch_updated ON trade_insights;
CREATE TRIGGER trade_insights_touch_updated
  BEFORE UPDATE ON trade_insights
  FOR EACH ROW EXECUTE FUNCTION trade_insights_touch_updated();

CREATE TABLE IF NOT EXISTS vision_preprocess_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  original_url text NOT NULL,
  processed_url text,
  -- Structured findings from the vision pass:
  --   quality: { sharpness, brightness, composition_score, overall }
  --   faces_blurred: int
  --   plates_blurred: int
  --   competitor_brands: string[]
  --   subject_tags: string[]        (auto-detected — trade / materials / stage)
  --   safety_signals: string[]      (workwear / hi-vis / safety line / etc.)
  --   suggested_action: 'publish' | 'review' | 'reject'
  --   suggested_reason: string
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_action text NOT NULL DEFAULT 'review',
  linked_event_id uuid REFERENCES business_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (suggested_action IN ('publish', 'review', 'reject'))
);

CREATE INDEX IF NOT EXISTS vision_records_merchant_idx
  ON vision_preprocess_records (merchant_id, created_at DESC);

ALTER TABLE trade_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_preprocess_records ENABLE ROW LEVEL SECURITY;

-- Trade insights are public read (no PII) — helps client-side compose
-- for anonymous marketplace visitors too.
DROP POLICY IF EXISTS trade_insights_public_r ON trade_insights;
CREATE POLICY trade_insights_public_r ON trade_insights
  FOR SELECT USING (true);
DROP POLICY IF EXISTS trade_insights_service ON trade_insights;
CREATE POLICY trade_insights_service ON trade_insights
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS vision_records_owner ON vision_preprocess_records;
CREATE POLICY vision_records_owner ON vision_preprocess_records
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());
DROP POLICY IF EXISTS vision_records_service ON vision_preprocess_records;
CREATE POLICY vision_records_service ON vision_preprocess_records
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
