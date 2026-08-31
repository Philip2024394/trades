-- 124_nex_vocab_relax_notnull.sql
--
-- Relax NOT NULL constraints on brain_english_vocabulary so Layer 1 corpus
-- lookups (which only carry definition_id) can commit without waiting for
-- example sentences. Example sentences get filled in a follow-up pass by
-- the Ollama expansion pipeline once base vocab is seeded.
--
-- Doctrine anchor: project_nex_fact_vs_knowledge_doctrine_2026_08_28.md ·
-- NEX FACT is claimed by having source + licence + confidence · not by
-- having every field populated. Missing fields ≠ untrustworthy row.

BEGIN;

ALTER TABLE nex.brain_english_vocabulary
  ALTER COLUMN example_sentence_en DROP NOT NULL,
  ALTER COLUMN example_sentence_id DROP NOT NULL,
  ALTER COLUMN definition_en DROP NOT NULL,
  ALTER COLUMN definition_id DROP NOT NULL;

COMMIT;
