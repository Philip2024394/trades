-- ═══════════════════════════════════════════════════════════════════
-- nex_collection_url_queue · add `confidence_score` column
--
-- Philip 2026-08-13 · NEX Brain Confidence Rule (FINAL).
-- Memory: project_nex_brain_confidence_rule_2026_08_13.md
--
-- Every candidate URL that the worker processes gets an evidence-driven
-- confidence score 0-100:
--   · 80-100  → auto-pass into the normal save/merge pipeline
--   ·  0-79   → status='needs_review' · human decides
--
-- Hard invariants (locked · never change without Philip):
--   · The score is derived only from actual extracted fields (rubric in
--     src/lib/nex/collection/candidateExtractor.ts).
--   · Points are NEVER awarded to help a record pass.
--   · Fields are NEVER fabricated to raise a score.
--   · Merging an existing seed is UPGRADE-only · never downgrade a record
--     that was already accepted, just because a later page has less info.
--   · The ~400 existing review records are NOT touched by this migration.
--
-- Score axis is INDEPENDENT of classification: a company can be classified
-- BOTH with score 76 (needs review) or REFACING with score 91 (auto-pass).
-- Both records are equally valid data; the score only gates the workflow.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.nex_collection_url_queue
  ADD COLUMN IF NOT EXISTS confidence_score integer;

-- 0-100 · CHECK enforces the range so the workflow never sees a rogue value.
-- Nullable because rows queued before the worker runs (or rows that never
-- reach extraction) have no score yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nex_collection_url_queue_confidence_score_check'
  ) THEN
    ALTER TABLE public.nex_collection_url_queue
      ADD CONSTRAINT nex_collection_url_queue_confidence_score_check
      CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));
  END IF;
END $$;

-- Admin dashboard uses this to filter the review queue (score < 80) and
-- the auto-pass audit trail (score >= 80).
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_confidence_score
  ON public.nex_collection_url_queue(confidence_score)
  WHERE confidence_score IS NOT NULL;
