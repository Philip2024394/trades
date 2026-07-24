-- Pending migration · AI Model Failure Handling · Provider health tracking
-- Depends on: ES-04 §11 (AI Safety · model outage fallback) · ES-01 §7 (AI orchestration)
-- Status: PREPARED · not yet in supabase/migrations/ · awaiting ADR-0019 acceptance (Workforce Trust Ladder references model reliability)
-- Notes: Existing `src/lib/studio/aiGateway.ts` already implements provider abstraction · this adds durable health tracking + fallback ladder configuration.

BEGIN;

-- ─── Provider health + circuit breaker state ─────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_platform_ai_provider_status (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           TEXT NOT NULL,       -- 'anthropic-opus' · 'anthropic-haiku' · 'openai-vision' · 'openai-embed' · 'google-docai'
  capability            TEXT NOT NULL,       -- 'reasoning' · 'vision' · 'embed' · 'ocr'

  -- Current state
  status                TEXT NOT NULL DEFAULT 'healthy'
                          CHECK (status IN ('healthy', 'degraded', 'circuit_open', 'unavailable')),
  since                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at       TIMESTAMPTZ,
  last_failure_at       TIMESTAMPTZ,

  -- Rolling failure count in current window (5-minute)
  failure_count_5m      INTEGER NOT NULL DEFAULT 0,
  success_count_5m      INTEGER NOT NULL DEFAULT 0,

  -- Circuit breaker state
  circuit_opened_at     TIMESTAMPTZ,
  circuit_cooldown_ends_at TIMESTAMPTZ,      -- 5-minute cool-down before retry

  -- Fallback registration · which provider takes over when this fails
  fallback_provider_id  TEXT,

  UNIQUE (provider_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_status_lookup
  ON public.hammerex_nex_platform_ai_provider_status (capability, status);

-- ─── Fallback ladder configuration ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_platform_ai_fallback_ladder (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability            TEXT NOT NULL,
  tier                  INTEGER NOT NULL,     -- 1=primary · 2=fallback1 · 3=fallback2 · 4=ultimate
  provider_id           TEXT NOT NULL,
  strategy              TEXT NOT NULL         -- 'live' · 'cached_similar' · 'canned_response'
                          CHECK (strategy IN ('live', 'cached_similar', 'canned_response', 'manual_queue')),
  UNIQUE (capability, tier)
);

-- ─── Seed fallback ladders per ES-04 §11.1 ─────────────────────

-- Reasoning capability
INSERT INTO public.hammerex_nex_platform_ai_fallback_ladder (capability, tier, provider_id, strategy) VALUES
  ('reasoning', 1, 'anthropic-opus', 'live'),
  ('reasoning', 2, 'anthropic-opus-bedrock-eu', 'live'),
  ('reasoning', 3, 'anthropic-haiku', 'live'),
  ('reasoning', 4, 'canned-apology', 'canned_response');

-- Vision capability
INSERT INTO public.hammerex_nex_platform_ai_fallback_ladder (capability, tier, provider_id, strategy) VALUES
  ('vision', 1, 'openai-vision', 'live'),
  ('vision', 2, 'cached-similar-image', 'cached_similar'),
  ('vision', 3, 'manual-queue', 'manual_queue');

-- Embeddings capability
INSERT INTO public.hammerex_nex_platform_ai_fallback_ladder (capability, tier, provider_id, strategy) VALUES
  ('embed', 1, 'openai-embed-3', 'live'),
  ('embed', 2, 'voyage-2', 'live'),
  ('embed', 3, 'cached-embeddings', 'cached_similar');

-- OCR capability
INSERT INTO public.hammerex_nex_platform_ai_fallback_ladder (capability, tier, provider_id, strategy) VALUES
  ('ocr', 1, 'google-docai', 'live'),
  ('ocr', 2, 'aws-textract', 'live'),
  ('ocr', 3, 'manual-queue', 'manual_queue');

-- ─── LLM call audit log (for cost tracking + drift detection) ────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_platform_ai_call_log (
  id                    BIGSERIAL PRIMARY KEY,
  merchant_slug         TEXT NOT NULL,
  provider_id           TEXT NOT NULL,
  capability            TEXT NOT NULL,
  context_domains       TEXT[] NOT NULL,      -- Per ADR-0021 · every call logs domain composition
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  cost_pence            INTEGER,              -- Cost in pence for aggregation
  latency_ms            INTEGER,
  status                TEXT NOT NULL CHECK (status IN ('success', 'fallback_used', 'error')),
  fallback_tier_used    INTEGER,              -- 1 if primary, 2+ if fallback
  prompt_version        TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- First month partition · additional partitions created monthly by cron
CREATE TABLE IF NOT EXISTS public.hammerex_nex_platform_ai_call_log_2026_08
  PARTITION OF public.hammerex_nex_platform_ai_call_log
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX IF NOT EXISTS idx_ai_call_log_merchant_time
  ON public.hammerex_nex_platform_ai_call_log (merchant_slug, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_provider_time
  ON public.hammerex_nex_platform_ai_call_log (provider_id, occurred_at DESC);

COMMENT ON TABLE public.hammerex_nex_platform_ai_provider_status IS
  'Phase 0 Week 3 · AI Provider health + circuit breaker · per ES-04 §11 + ES-01 §7.';
COMMENT ON TABLE public.hammerex_nex_platform_ai_fallback_ladder IS
  'Phase 0 Week 3 · Per-capability fallback ladder configuration · seed per ES-04 §11.1.';
COMMENT ON TABLE public.hammerex_nex_platform_ai_call_log IS
  'Phase 0 Week 3 · Immutable LLM call audit log · partitioned monthly · per ES-05 §4.7 cost monitoring + ADR-0021 domain composition tracking.';

COMMIT;
