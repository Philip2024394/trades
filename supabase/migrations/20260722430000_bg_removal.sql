-- Background removal feature — everything self-hosted.
--
-- We ship an ONNX model (RMBG-1.4, Apache-2.0) to the merchant's
-- browser, run inference on their device via ONNX Runtime Web, and
-- upload the transparent-background PNG back to Supabase Storage.
-- Zero third-party API dependencies.
--
-- Tables track fair-use quota (monthly counter + per-image ledger)
-- + a rolling 24h anti-scrape cap. Model files live in a public
-- Storage bucket so the CDN serves them.

-- Monthly usage counter. Primary key = (merchant_slug, month_yyyymm)
-- so INSERT ON CONFLICT gives us atomic increments. Rolled over by
-- the existing monthly cron.
CREATE TABLE IF NOT EXISTS public.hammerex_bgremoval_usage (
  merchant_slug TEXT NOT NULL,
  month_yyyymm  TEXT NOT NULL,
  used_count    INTEGER NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (merchant_slug, month_yyyymm)
);

-- Per-image ledger — every successful upload writes ONE row.
-- Powers the rolling 24h cap AND a future "your recent cutouts"
-- dashboard view.
CREATE TABLE IF NOT EXISTS public.hammerex_bgremoval_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug  TEXT NOT NULL,
  source_bytes   INTEGER,
  output_bytes   INTEGER,
  storage_path   TEXT NOT NULL,
  public_url     TEXT NOT NULL,
  inference_ms   INTEGER,        -- how long the model took on the
                                  -- merchant's device — powers a
                                  -- p50/p95 dashboard
  device_backend TEXT,            -- 'webgpu' | 'wasm' | 'cpu' —
                                  -- lets us know if we should push
                                  -- WebGPU harder
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bgremoval_events_merchant_recent
  ON public.hammerex_bgremoval_events (merchant_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bgremoval_events_created_at
  ON public.hammerex_bgremoval_events (created_at DESC);

-- Storage buckets — model weights + processed outputs.
--   bgremoval-models     — public read, service-role write.
--                          Holds ONNX weights + preprocessor config.
--                          Served via Supabase CDN to the browser
--                          once, cached forever.
--   bgremoval-outputs    — public read, service-role write.
--                          Merchant's processed transparent PNGs.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bgremoval-models',  'bgremoval-models',  TRUE),
  ('bgremoval-outputs', 'bgremoval-outputs', TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS on the counter + ledger tables — service-role only. Every
-- write goes via the /api/site/editor/bg-removal/save endpoint
-- which auths + gates the merchant.
ALTER TABLE public.hammerex_bgremoval_usage  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_bgremoval_events ENABLE ROW LEVEL SECURITY;
