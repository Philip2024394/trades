-- 20260728100600_nex_brain_answers.sql
-- Living Trade Brains · Runtime Answer Log · ADR-0037
--
-- Every response served by a Brain surface (chat · ask · retrieve)
-- is logged here with the full explainability payload. Enables:
--   · Feedback capture (low_confidence + I-don't-know surfaced to authors)
--   · Outcome tracking (each answer joinable to actual result later)
--   · Trust ledger (every answer traceable to a specific brain_version)
--   · Coverage measurement (per-topic query volume + confidence trends)

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_answers (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug           text          NOT NULL
                                     REFERENCES public.hammerex_nex_brains(slug)
                                     ON DELETE RESTRICT,
  brain_version_id     uuid          NOT NULL
                                     REFERENCES public.hammerex_nex_brain_versions(id)
                                     ON DELETE RESTRICT,
  query_text           text          NOT NULL,
  query_hash           text          NOT NULL,
  -- sha256 of normalised query text · for dedup + trend analysis
  answer_text          text          NOT NULL,
  evidence_json        jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- array of { kind, ref, excerpt? } per ADR-0037 explainability contract
  trade_rule           text          NULL,
  reason               text          NOT NULL,
  confidence           numeric(5,4)  NOT NULL,
  -- 0..1 · below 0.85 flags to feedback queue
  answer_kind          text          NOT NULL DEFAULT 'direct',
  -- direct · derived · unknown · low_confidence · declined
  answered_by_channel  text          NOT NULL DEFAULT 'api',
  -- api · chat · web · mobile · admin_preview
  user_id_hash         text          NULL,
  -- sha256 of user identifier · never store raw PII
  session_hash         text          NULL,
  answered_at          timestamptz   NOT NULL DEFAULT now(),
  metadata             jsonb         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_brain_answers_brain_version
  ON public.hammerex_nex_brain_answers (brain_version_id, answered_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_answers_brain_slug_time
  ON public.hammerex_nex_brain_answers (brain_slug, answered_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_answers_low_confidence
  ON public.hammerex_nex_brain_answers (brain_slug, answered_at DESC)
  WHERE confidence < 0.85 OR answer_kind IN ('unknown', 'low_confidence');

CREATE INDEX IF NOT EXISTS ix_brain_answers_query_hash
  ON public.hammerex_nex_brain_answers (brain_slug, query_hash);

ALTER TABLE public.hammerex_nex_brain_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_answers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated admins can read aggregated answer data. Individual
-- query_text is written by the runtime; personal-identifier fields
-- are hashed at insert time (never raw).
CREATE POLICY "authenticated_read_all" ON public.hammerex_nex_brain_answers
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.hammerex_nex_brain_answers IS
  'Living Trade Brains · Runtime Answer Log · ADR-0037 · explainability payload preserved for outcome tracking';
