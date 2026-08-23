-- 068_nex_image_intake_extension.sql
--
-- NEX Image + Description Intelligence Worker · schema extension.
-- Doctrine anchor: project_nex_owns_intelligence_capabilities_2026_08_22
--                  project_nex_walker_freshness_doctrine_2026_08_21
--                  ADR-0027/0028/0029/0030/0033
--
-- Extends existing nex.knowledge_inbox (mig 043) with two columns needed
-- for image-plus-description intake:
--
--   description        — user-supplied text alongside the image (first-class
--                        input · often the strongest signal)
--   extraction_result  — structured jsonb of what the worker extracted
--                        (concept · category · characteristics · related ·
--                         evidence · provenance · confidence · vision_provider ·
--                         ocr_provider · perceptual_hash · classification_band)
--
-- Does NOT create a parallel intake table. Reuses knowledge_inbox as the
-- authoritative source of truth (per: "no second business/intake database").
--
-- SAFE TO RE-RUN · additive columns only.
--
-- Reversible:
--   BEGIN;
--   ALTER TABLE nex.knowledge_inbox DROP COLUMN IF EXISTS description;
--   ALTER TABLE nex.knowledge_inbox DROP COLUMN IF EXISTS extraction_result;
--   COMMIT;

ALTER TABLE nex.knowledge_inbox
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS extraction_result  jsonb;

COMMENT ON COLUMN nex.knowledge_inbox.description IS
  'User-supplied text description of the image. First-class input · often the strongest concept-extraction signal · works without vision.';

COMMENT ON COLUMN nex.knowledge_inbox.extraction_result IS
  'Structured extraction output from the Image + Description Intelligence Worker. Shape: { concept, category, food, typical_visual_characteristics, related_concepts[], evidence, source, source_type, rights_status, ai_generated, vision_provider, ocr_provider, perceptual_hash, confidence, classification_band }. See project_nex_owns_intelligence_capabilities_2026_08_22 for provider-independence rules.';

-- Index for classification-band filtering (admin surface reads by band)
CREATE INDEX IF NOT EXISTS idx_knowledge_inbox_extraction_band
  ON nex.knowledge_inbox ((extraction_result->>'classification_band'))
  WHERE extraction_result IS NOT NULL;
