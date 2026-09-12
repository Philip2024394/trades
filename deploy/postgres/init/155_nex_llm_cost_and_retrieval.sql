-- 155_nex_llm_cost_and_retrieval.sql
--
-- Founder Phase 4 · P4-2 (retrieval telemetry) + P4-3 (cost aggregation).
-- 2026-09-09.
--
-- Adds three surfaces:
--   1. nex.turn_latency_event columns · prompt_tokens · response_tokens ·
--      provider_cost_usd (nullable · zero for Ollama)
--   2. nex.llm_cost_config · per-model per-1K-token pricing
--   3. nex.retrieval_event · per-retrieval path + top-hit similarity

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- 1 · Cost columns on turn_latency_event
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE nex.turn_latency_event
  ADD COLUMN IF NOT EXISTS prompt_tokens integer NULL,
  ADD COLUMN IF NOT EXISTS response_tokens integer NULL,
  ADD COLUMN IF NOT EXISTS provider_cost_usd double precision NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 2 · Per-model pricing
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.llm_cost_config (
  model_id             text        PRIMARY KEY,
  provider             text        NOT NULL,
  cost_per_1k_prompt_usd  double precision NOT NULL,
  cost_per_1k_response_usd double precision NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  note                 text        NULL
);

-- Seed common models · Ollama = 0 (local) · frontier costs from public pricing.
INSERT INTO nex.llm_cost_config (model_id, provider, cost_per_1k_prompt_usd, cost_per_1k_response_usd, note)
VALUES
  ('qwen2.5:3b',                  'ollama',    0.0,     0.0,     'local via Ollama · zero cost'),
  ('qwen2.5:7b',                  'ollama',    0.0,     0.0,     'local via Ollama · zero cost'),
  ('llava:7b',                    'ollama',    0.0,     0.0,     'local vision via Ollama · zero cost'),
  ('nomic-embed-text',            'ollama',    0.0,     0.0,     'local embeddings via Ollama · zero cost'),
  ('mock:test',                   'mock',      0.0,     0.0,     'regression testing · zero cost'),
  ('gpt-4o-mini',                 'openai',    0.00015, 0.0006,  'OpenAI public pricing 2026-01'),
  ('gpt-4o',                      'openai',    0.0025,  0.010,   'OpenAI public pricing 2026-01'),
  ('claude-3-5-sonnet',           'anthropic', 0.003,   0.015,   'Anthropic public pricing 2026-01'),
  ('claude-3-5-haiku',            'anthropic', 0.001,   0.005,   'Anthropic public pricing 2026-01'),
  ('gemini-1.5-flash',            'google',    0.000075, 0.0003, 'Google public pricing 2026-01'),
  ('llama-3.1-70b',               'groq',      0.00059, 0.00079, 'Groq public pricing 2026-01')
ON CONFLICT (model_id) DO UPDATE
  SET provider = EXCLUDED.provider,
      cost_per_1k_prompt_usd = EXCLUDED.cost_per_1k_prompt_usd,
      cost_per_1k_response_usd = EXCLUDED.cost_per_1k_response_usd,
      updated_at = now();

CREATE INDEX IF NOT EXISTS idx_nex_llm_cost_provider
  ON nex.llm_cost_config (provider);

COMMENT ON TABLE nex.llm_cost_config IS
  'Founder Phase 4 · P4-3 · per-model per-1K-token pricing. Zero for Ollama (local). Updated from public vendor pricing.';

-- ═══════════════════════════════════════════════════════════════════
-- 3 · Retrieval event · per-turn per-path telemetry
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.retrieval_event (
  event_id             uuid        PRIMARY KEY,
  emitted_at           timestamptz NOT NULL DEFAULT now(),
  conversation_id      text        NULL,
  retriever_path       text        NOT NULL,               -- kb_hybrid · web_composite · research_brain · vision · file · memory
  domain               text        NULL,
  query_length_chars   integer     NULL,
  hit_count            integer     NOT NULL DEFAULT 0,
  top_hit_similarity   double precision NULL,              -- 0..1 · from Gate v2 alignment scorer
  latency_ms           integer     NOT NULL,
  error                text        NULL,
  sub_provider_meta    jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nex_retrieval_event_recent
  ON nex.retrieval_event (emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_retrieval_event_path
  ON nex.retrieval_event (retriever_path, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_retrieval_event_conv
  ON nex.retrieval_event (conversation_id, emitted_at DESC);

COMMENT ON TABLE nex.retrieval_event IS
  'Founder Phase 4 · P4-2 · per-retrieval-path telemetry (kb_hybrid · web_composite · research_brain · vision · file · memory). Observatory publishes Recall@K + MRR when labelled corpus available.';
