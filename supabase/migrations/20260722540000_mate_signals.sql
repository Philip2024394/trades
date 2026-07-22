-- Mate step 5: proactive signals. Nightly cron runs detectors per
-- merchant and upserts nudges into this table. Widget reads unread
-- and shows a badge on the floating chip. This is where Mate stops
-- being reactive and starts flagging things TO the user.
--
-- One row per (surface, user_key, kind). Re-firing the same detector
-- for the same user updates the same row instead of duplicating.

CREATE TABLE IF NOT EXISTS public.hammerex_mate_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface      TEXT NOT NULL,     -- 'merchant' | 'homeowner'
  user_key     TEXT NOT NULL,
  kind         TEXT NOT NULL,     -- 'review_unreplied' | 'washer_low' | 'trust_ladder_next' | ...
  priority     SMALLINT NOT NULL DEFAULT 2,   -- 1 high · 2 medium · 3 low
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  action_url   TEXT,              -- optional deep-link the widget CTA opens
  action_label TEXT,              -- CTA button text
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'new' | 'read' | 'dismissed' | 'actioned'
  status       TEXT NOT NULL DEFAULT 'new',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ,
  actioned_at  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (surface, user_key, kind)
);

CREATE INDEX IF NOT EXISTS idx_mate_signals_unread
  ON public.hammerex_mate_signals (surface, user_key, priority)
  WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_mate_signals_recent
  ON public.hammerex_mate_signals (generated_at DESC);

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION public.fn_mate_signals_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mate_signals_touch ON public.hammerex_mate_signals;
CREATE TRIGGER trg_mate_signals_touch
  BEFORE UPDATE ON public.hammerex_mate_signals
  FOR EACH ROW EXECUTE FUNCTION public.fn_mate_signals_touch();

ALTER TABLE public.hammerex_mate_signals ENABLE ROW LEVEL SECURITY;
