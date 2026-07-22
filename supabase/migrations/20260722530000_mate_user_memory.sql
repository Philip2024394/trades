-- Mate step 4: cross-session memory. One rolling summary + salient
-- facts per (surface, user_key). Refreshed by a background job every
-- ~8 messages so Mate remembers who you are between conversations.
--
-- Visitor surface intentionally excluded — they're anonymous IP hashes
-- so a "memory" would tag the wrong person once the IP recycles.

CREATE TABLE IF NOT EXISTS public.hammerex_mate_user_memory (
  -- 'merchant' | 'homeowner'
  surface                    TEXT NOT NULL,
  -- merchant slug OR homeowner id
  user_key                   TEXT NOT NULL,
  -- <200-word rolling summary Mate reads on every turn
  summary                    TEXT,
  -- Structured key-value facts extracted by the summariser
  salient_facts              JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Bookkeeping — so the refresh trigger knows when to fire again
  refreshed_at               TIMESTAMPTZ,
  message_count_at_refresh   INTEGER NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (surface, user_key)
);

CREATE INDEX IF NOT EXISTS idx_mate_memory_updated
  ON public.hammerex_mate_user_memory (updated_at DESC);

-- updated_at auto-touch
CREATE OR REPLACE FUNCTION public.fn_mate_memory_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mate_memory_touch ON public.hammerex_mate_user_memory;
CREATE TRIGGER trg_mate_memory_touch
  BEFORE UPDATE ON public.hammerex_mate_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.fn_mate_memory_touch();

ALTER TABLE public.hammerex_mate_user_memory ENABLE ROW LEVEL SECURITY;
