-- Trade Intelligence Phase 3 — Research Reports + Weekly Reports.
--
-- Research Report: what the merchant asked Nex to research, what
-- sources were checked, what was proposed. Every proposed knowledge
-- item lands in the review queue linked back via research_report_id.
--
-- Weekly Report: the automated Monday summary — counts + pending
-- reviews + weak-spot alerts. Cron writes rows; admin surface reads.

-- ─── Research reports ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_research_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL,                        -- the merchant's query
  trade_hint        TEXT,
  requested_by      TEXT NOT NULL,                        -- merchant_slug or admin user
  requested_by_kind TEXT NOT NULL CHECK (requested_by_kind IN ('staff','merchant','builder')),
  status            TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('running','complete','failed')),
  sources_checked   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ name, kind, ok }]
  method            TEXT NOT NULL DEFAULT 'reasoning',    -- 'reasoning' | 'web-fetch' | 'hybrid'
  confidence        INTEGER NOT NULL DEFAULT 80 CHECK (confidence BETWEEN 0 AND 100),
  proposed_count    INTEGER NOT NULL DEFAULT 0,
  changed_count     INTEGER NOT NULL DEFAULT 0,
  conflict_count    INTEGER NOT NULL DEFAULT 0,
  estimated_review_minutes INTEGER,
  summary_md        TEXT,                                  -- brief plain-English summary
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nex_research_recent
  ON public.hammerex_nex_research_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_research_requester
  ON public.hammerex_nex_research_reports (requested_by_kind, requested_by, created_at DESC);

ALTER TABLE public.hammerex_nex_research_reports ENABLE ROW LEVEL SECURITY;

-- Merchants see their own research reports (RLS).
DROP POLICY IF EXISTS nex_research_requester_read ON public.hammerex_nex_research_reports;
CREATE POLICY nex_research_requester_read ON public.hammerex_nex_research_reports
  FOR SELECT TO authenticated
  USING (
    requested_by_kind = 'merchant'
    AND requested_by = (auth.jwt() ->> 'merchant_slug')
  );

-- Link review queue items back to the research report that produced them.
ALTER TABLE public.hammerex_nex_review_queue
  ADD COLUMN IF NOT EXISTS research_report_id UUID
  REFERENCES public.hammerex_nex_research_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nex_review_research
  ON public.hammerex_nex_review_queue (research_report_id)
  WHERE research_report_id IS NOT NULL;

-- ─── Weekly reports ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_weekly_reports (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_starting          DATE NOT NULL,
  pending_reviews        INTEGER NOT NULL DEFAULT 0,
  approved_this_week     INTEGER NOT NULL DEFAULT 0,
  rejected_this_week     INTEGER NOT NULL DEFAULT 0,
  new_entries_this_week  INTEGER NOT NULL DEFAULT 0,
  updates_by_trade       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { carpentry: 12, roofing: 5, ... }
  weakest_trade          TEXT,
  weakest_trade_pct      INTEGER,
  estimated_review_minutes INTEGER,
  greeting_md            TEXT,                                 -- pre-rendered "Good morning Phil..." block
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (week_starting)
);

CREATE INDEX IF NOT EXISTS idx_nex_weekly_recent
  ON public.hammerex_nex_weekly_reports (week_starting DESC);

ALTER TABLE public.hammerex_nex_weekly_reports ENABLE ROW LEVEL SECURITY;

-- ─── Merchant last-seen (for chat continuity greeting) ───────────
-- Nex greeting reads this to say "Welcome back" vs "Long time no see".
-- Nullable — first-visit merchants haven't got one yet.
-- Merchants live in hammerex_trade_off_listings per studio/session.ts.

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS nex_last_seen_at TIMESTAMPTZ;

-- ─── Column comments ─────────────────────────────────────────────
COMMENT ON TABLE public.hammerex_nex_research_reports IS
  'A merchant asks Nex to research a topic. Nex produces one of these, and every proposed knowledge item lands in the review queue linked via research_report_id.';
COMMENT ON TABLE public.hammerex_nex_weekly_reports IS
  'Monday-morning digest per week. Populated by cron /api/cron/nex-weekly-report.';
COMMENT ON COLUMN public.hammerex_trade_off_listings.nex_last_seen_at IS
  'Updated on every Nex chat interaction so greeting can say "welcome back" etc.';
