-- 147_nex_truth_engine.sql
--
-- NEX LIVE CHAT · TRUTH + RETRIEVAL ENGINE · Phase 3.2 · storage layer.
-- Founder BEGIN Phase 3.2 · Master AI Engineer · 2026-09-09.
--
-- Doctrine anchor:
--   Founder Phase 3.2 mandate 2026-09-09 (Truth + Retrieval Engine).
--   Priority order: freshness + conflict resolution → three-level retrieval
--   → real fingerprint short-circuit → temporal fragments.
--
-- Purpose (STRICT this migration):
--   1. nex.fact_conflict         · durable record of contradictory fact
--                                  values seen from ≥2 sources.
--   2. nex.fact_lifecycle_event  · optional audit trail of fact status
--                                  transitions (unknown → observed →
--                                  verified → stale → conflicting → resolved).
--   3. nex.retrieval_hit         · observability sample of L1/L2/L3
--                                  retrieval decisions per turn.
--
-- What this migration does NOT do:
--   · does NOT alter existing tables
--   · does NOT insert rows
--   · does NOT drop anything
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.retrieval_hit CASCADE;
--     DROP TABLE IF EXISTS nex.fact_lifecycle_event CASCADE;
--     DROP TABLE IF EXISTS nex.fact_conflict CASCADE;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- fact_conflict · durable record of contradictory facts
-- ═══════════════════════════════════════════════════════════════════
-- One row per (domain, entity_ref, intent_slug) that has ≥2 disagreeing
-- source values. UNIQUE on the triple so re-detection UPSERTs rather
-- than duplicating.
CREATE TABLE IF NOT EXISTS nex.fact_conflict (
  conflict_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                text        NOT NULL,
  entity_ref            text        NOT NULL,
  intent_slug           text        NOT NULL,
  conflicting_values    jsonb       NOT NULL,   -- [{value, source_ref, confidence, observed_at}, ...]
  first_detected_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  seen_count            integer     NOT NULL DEFAULT 1,
  resolved_at           timestamptz NULL,
  resolved_by           text        NULL,       -- verifier · master_ai_engineer · owner_override
  resolution_value      jsonb       NULL,
  UNIQUE (domain, entity_ref, intent_slug)
);

CREATE INDEX IF NOT EXISTS idx_nex_fact_conflict_open
  ON nex.fact_conflict (domain, resolved_at NULLS FIRST, seen_count DESC);

COMMENT ON TABLE nex.fact_conflict IS
  'Founder BEGIN Phase 3.2 · durable record of contradictory facts. UNIQUE on (domain, entity_ref, intent_slug). Composer never picks a random side · it emits an honest conflict prefix instead.';

-- ═══════════════════════════════════════════════════════════════════
-- fact_lifecycle_event · optional audit trail
-- ═══════════════════════════════════════════════════════════════════
-- Non-blocking. Truth Engine may append events; composer/adapter never
-- read from this table on the hot path. Useful for post-hoc analysis.
CREATE TABLE IF NOT EXISTS nex.fact_lifecycle_event (
  event_id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                text        NOT NULL,
  entity_ref            text        NOT NULL,
  intent_slug           text        NOT NULL,
  from_status           text        NULL,       -- previous status
  to_status             text        NOT NULL,   -- unknown · observed · verified · stale · conflicting · resolved
  trigger_source        text        NOT NULL,   -- verifier · live_chat · master_ai_engineer · freshness_worker · owner_override
  actor                 text        NULL,
  reason                text        NULL,
  emitted_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_fact_lifecycle_event_entity
  ON nex.fact_lifecycle_event (domain, entity_ref, intent_slug, emitted_at DESC);

COMMENT ON TABLE nex.fact_lifecycle_event IS
  'Founder BEGIN Phase 3.2 · optional lifecycle audit. Not on the hot path.';

-- ═══════════════════════════════════════════════════════════════════
-- retrieval_hit · L1/L2/L3 observability
-- ═══════════════════════════════════════════════════════════════════
-- Sample rate is controlled by application code (typically 1 in N turns).
-- Aggregated by observatory to report retrieval-level distribution.
CREATE TABLE IF NOT EXISTS nex.retrieval_hit (
  hit_id                bigserial   PRIMARY KEY,
  domain                text        NOT NULL,
  conversation_id       text        NULL,
  level                 text        NOT NULL,   -- L1_exact · L2_structured · L3_semantic · none
  matched               boolean     NOT NULL,
  intent_slug           text        NULL,
  entity_ref            text        NULL,
  latency_ms            integer     NOT NULL,
  recorded_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_retrieval_hit_recorded
  ON nex.retrieval_hit (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_retrieval_hit_domain_level
  ON nex.retrieval_hit (domain, level);

COMMENT ON TABLE nex.retrieval_hit IS
  'Founder BEGIN Phase 3.2 · per-turn retrieval level record for observability. Sampled · not on hot path when disabled.';
