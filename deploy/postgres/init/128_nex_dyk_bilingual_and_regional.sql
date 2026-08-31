-- 128_nex_dyk_bilingual_and_regional.sql
--
-- Philip 2026-08-28 · TWO enhancements to brain_did_you_know_indonesia:
--   1. Bilingual columns (title_id, body_id) so Indonesian users read in
--      Bahasa Indonesia · populated by Ollama translator walker
--   2. Regional expansion topics added to knowledge seed so walkers dig
--      per-province deep-dives (Bali, Sumatra, Java, Sulawesi, etc.)

BEGIN;

-- 1 · bilingual columns · nullable so backfill can happen incrementally
ALTER TABLE nex.brain_did_you_know_indonesia
  ADD COLUMN IF NOT EXISTS title_id text,
  ADD COLUMN IF NOT EXISTS body_id  text,
  ADD COLUMN IF NOT EXISTS translated_at timestamptz;

-- Index for translator walker to find rows needing translation
CREATE INDEX IF NOT EXISTS idx_dyk_needs_translation
  ON nex.brain_did_you_know_indonesia (created_at)
  WHERE body_id IS NULL AND is_active = true;

COMMIT;
