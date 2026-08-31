-- 123_nex_truth_class_expand.sql
--
-- NEX FACT / NEX KNOWLEDGE doctrine · Philip 2026-08-28.
--
-- Extends nex.knowledge_inbox.truth_class CHECK constraint to include
-- two new values that map to the NEX KNOWLEDGE badge:
--
--   unconfirmed   · information from a legitimate source that has NOT been
--                   independently verified · e.g. eyewitness reports · user
--                   contributions · scraped listings without cross-source
--                   confirmation. Shown to users with NEX KNOWLEDGE badge.
--
--   ai_generated  · content produced by an LLM (Ollama or similar) that has
--                   NOT been ground-truth-validated (round-trip failed OR
--                   no corpus anchor available). Shown to users with NEX
--                   KNOWLEDGE badge and explicit "AI-generated" caveat.
--
-- Mapping to the two constitutional badges:
--   NEX FACT       → confirmed_fact · academic_reference
--   NEX KNOWLEDGE  → traditional_folk · spiritual_belief · unconfirmed · ai_generated
--
-- Doctrine anchor: project_nex_fact_vs_knowledge_doctrine_2026_08_28.md

BEGIN;

ALTER TABLE nex.knowledge_inbox
  DROP CONSTRAINT IF EXISTS knowledge_inbox_truth_class_valid;

ALTER TABLE nex.knowledge_inbox
  ADD CONSTRAINT knowledge_inbox_truth_class_valid CHECK (
    truth_class IS NULL OR truth_class = ANY (ARRAY[
      'confirmed_fact',       -- NEX FACT
      'academic_reference',   -- NEX FACT
      'traditional_folk',     -- NEX KNOWLEDGE
      'spiritual_belief',     -- NEX KNOWLEDGE
      'unconfirmed',          -- NEX KNOWLEDGE (new)
      'ai_generated'          -- NEX KNOWLEDGE (new)
    ])
  );

-- Helpful index for badge-classification queries at read time.
CREATE INDEX IF NOT EXISTS idx_knowledge_inbox_truth_class
  ON nex.knowledge_inbox (truth_class)
  WHERE truth_class IS NOT NULL;

COMMIT;
