-- 121_nex_ollama_translation_sources.sql
--
-- NEX Ollama Translation Pipeline · Philip 2026-08-28.
--
-- Extends nex.knowledge_inbox source allow-list to include local Ollama
-- translation sources so the translation pipeline can write EN → ID rows
-- without violating the CHECK constraint.
--
-- Also whitelists Ollama-generated sources for future subsystems:
--   ollama_qwen2.5_id_translation    · EN → ID translation
--   ollama_qwen2.5_en_translation    · ID → EN translation
--   ollama_qwen2.5_summary           · summarisation of long-form content
--   ollama_qwen2.5_qa                · Q&A extraction from source content
--   ollama_qwen2.5_english_lesson    · English lesson generation for ID learners
--   ollama_qwen2.5_grammar_check     · grammar-correction pass on translations
--   ollama_local_generic             · generic escape hatch, model logged in meta
--
-- Doctrine anchors:
--   · project_nex_translation_and_learning_vision_2026_08_28.md
--   · project_nex_free_infrastructure_principle_2026_08_27.md
--
-- Provenance for every Ollama row is preserved in extraction_result jsonb:
--   { translated_from_source, translated_from_id, model, model_provider,
--     latency_ms, confidence_band, licence_terms, translated_at_iso }

BEGIN;

ALTER TABLE nex.knowledge_inbox
  DROP CONSTRAINT IF EXISTS knowledge_inbox_source_check;

ALTER TABLE nex.knowledge_inbox
  ADD CONSTRAINT knowledge_inbox_source_check CHECK (source = ANY (ARRAY[
    -- pre-existing human/manual sources
    'chatgpt-approved',
    'claude-generated',
    'raw-research',
    'internet-article',
    'needs-verification',
    'gov-standards',
    'customer-qa',
    'personal-ideas',
    -- pre-existing walker sources
    'wikipedia_en',
    'wikipedia_id',
    'wikidata',
    'wikivoyage',
    'commons',
    'bps_gov_id',
    'kemenparekraf',
    'openstreetmap',
    'wikimedia',
    -- 2026-08-28 · Ollama local LLM sources
    'ollama_qwen2.5_id_translation',
    'ollama_qwen2.5_en_translation',
    'ollama_qwen2.5_summary',
    'ollama_qwen2.5_qa',
    'ollama_qwen2.5_english_lesson',
    'ollama_qwen2.5_grammar_check',
    'ollama_local_generic'
  ]));

-- Add 'shadow' to status allow-list so translation rows can be inserted in a
-- shadow state that HQ can review before promotion.
ALTER TABLE nex.knowledge_inbox
  DROP CONSTRAINT IF EXISTS knowledge_inbox_status_check;

ALTER TABLE nex.knowledge_inbox
  ADD CONSTRAINT knowledge_inbox_status_check CHECK (status = ANY (ARRAY[
    'waiting',
    'processing',
    'review',
    'processed',
    'shadow'
  ]));

-- Helpful index for translation pipeline gap-detection queries.
CREATE INDEX IF NOT EXISTS idx_knowledge_inbox_brain_topic_source
  ON nex.knowledge_inbox (brain_slug, topic_key, source);

COMMIT;
