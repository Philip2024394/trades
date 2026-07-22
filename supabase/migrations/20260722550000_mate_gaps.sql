-- Mate step 7: knowledge gaps queue. When a user thumbs-down a Mate
-- reply, we log the shape of the failure into this table for admin
-- curation. Similar questions cluster onto one row via cluster_key
-- so 20 people asking the same thing show up as one gap with count=20.
--
-- Admin at /admin/mate/gaps triages: promote-to-KB, dismiss, or leave
-- open. Promoted gaps link back to the knowledge_entry they became.

CREATE TABLE IF NOT EXISTS public.hammerex_mate_gaps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key          TEXT NOT NULL UNIQUE,       -- hash of normalized question
  surface              TEXT NOT NULL,
  sample_question      TEXT NOT NULL,              -- first question that flagged it
  sample_reply         TEXT NOT NULL,              -- reply that got thumbs-down
  sample_message_id    UUID REFERENCES public.hammerex_mate_messages(id) ON DELETE SET NULL,
  context_snapshot     JSONB,                      -- from the flagged message
  thumbs_down_count    INTEGER NOT NULL DEFAULT 1,
  first_flagged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_flagged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'open' | 'reviewed' | 'promoted' | 'dismissed'
  status               TEXT NOT NULL DEFAULT 'open',
  reviewed_by          TEXT,
  reviewed_at          TIMESTAMPTZ,
  promoted_kb_entry_id UUID,
  notes                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mate_gaps_open_count
  ON public.hammerex_mate_gaps (status, thumbs_down_count DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_mate_gaps_recent
  ON public.hammerex_mate_gaps (last_flagged_at DESC);

CREATE OR REPLACE FUNCTION public.fn_mate_gaps_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mate_gaps_touch ON public.hammerex_mate_gaps;
CREATE TRIGGER trg_mate_gaps_touch
  BEFORE UPDATE ON public.hammerex_mate_gaps
  FOR EACH ROW EXECUTE FUNCTION public.fn_mate_gaps_touch();

ALTER TABLE public.hammerex_mate_gaps ENABLE ROW LEVEL SECURITY;
