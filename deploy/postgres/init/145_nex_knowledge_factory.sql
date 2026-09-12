-- 145_nex_knowledge_factory.sql
--
-- NEX LIVE CHAT · CONTINUOUS KNOWLEDGE ENGINE · storage layer.
-- Founder BEGIN Phase 2 · Master AI Engineer · 2026-09-09.
--
-- Doctrine anchor:
--   Founder final directive 2026-09-09 (permanent-knowledge-factory).
--   §2 · No duplicate answers · reference canonical facts.
--   §17 · Storage discipline · deduplicate, no unbounded logs.
--   §22 · Cross-category contract · every category uses THESE tables.
--
-- Purpose (STRICT this migration):
--   1. nex.entity_index         · one row per canonical entity per domain
--   2. nex.question_variant     · one row per normalised question variant
--                                 with fingerprint · NO answer text stored
--   3. nex.knowledge_gap        · durable feedback queue
--   4. nex.kf_worker_heartbeat  · liveness for question-factory workers
--                                 (separate from public.worker_heartbeats
--                                 which serves the cloud brain workers)
--   5. nex.category_scorecard   · cache row per domain
--   6. nex.master_rulebook      · persistent mission per domain
--
-- What this migration does NOT do:
--   · does NOT insert rows (seeder runs separately)
--   · does NOT alter existing tables
--   · does NOT drop anything
--   · does NOT touch accommodation_business, provenance, evidence tables
--   · does NOT create any RLS policies specific to Supabase — matches
--     the pattern established by 143/144
--
-- Reversible (not scripted · Philip's design rule 7):
--   BEGIN;
--     DROP TABLE IF EXISTS nex.master_rulebook CASCADE;
--     DROP TABLE IF EXISTS nex.category_scorecard CASCADE;
--     DROP TABLE IF EXISTS nex.kf_worker_heartbeat CASCADE;
--     DROP TABLE IF EXISTS nex.knowledge_gap CASCADE;
--     DROP TABLE IF EXISTS nex.question_variant CASCADE;
--     DROP TABLE IF EXISTS nex.entity_index CASCADE;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- entity_index · one row per canonical entity per domain
-- ═══════════════════════════════════════════════════════════════════
-- Every question_variant / knowledge_gap references an entity_ref here.
-- The row is a lightweight index — the authoritative source stays in the
-- domain's canonical table (e.g. nex.accommodation_business). This table
-- exists so the question factory doesn't need to know per-domain table
-- schemas · it queries entity_index by domain.
CREATE TABLE IF NOT EXISTS nex.entity_index (
  entity_ref            text        NOT NULL,
  domain                text        NOT NULL,
  canonical_name        text        NOT NULL,
  aliases               text[]      NOT NULL DEFAULT ARRAY[]::text[],
  city                  text        NULL,
  source_table          text        NOT NULL,   -- e.g. 'nex.accommodation_business'
  source_pk_column      text        NOT NULL,   -- e.g. 'public_listing_ref'
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, entity_ref)
);

CREATE INDEX IF NOT EXISTS idx_nex_entity_index_domain_city
  ON nex.entity_index (domain, city);

CREATE INDEX IF NOT EXISTS idx_nex_entity_index_domain_canonical_name
  ON nex.entity_index (domain, canonical_name);

COMMENT ON TABLE nex.entity_index IS
  'Founder BEGIN Phase 2 · one lightweight row per canonical entity per domain. Refs the authoritative source table for the domain. Question factory + gap queue use this to avoid per-domain schema knowledge.';

-- ═══════════════════════════════════════════════════════════════════
-- question_variant · compact question storage · NO ANSWER TEXT
-- ═══════════════════════════════════════════════════════════════════
-- One row per normalised variant. Fingerprint is a SHA256 hex over
-- (normalised_text · domain · entity_ref · intent_slug). If two callers
-- generate the SAME variant, they collide on the same fingerprint and
-- UPSERT — no duplicates.
--
-- Answers are NEVER stored here. Answers are composed at read time from
-- required_fact_slugs against the canonical fact store.
CREATE TABLE IF NOT EXISTS nex.question_variant (
  fingerprint           text        PRIMARY KEY,          -- SHA256 hex
  domain                text        NOT NULL,
  entity_ref            text        NOT NULL,
  intent_slug           text        NOT NULL,
  raw_text              text        NOT NULL,
  normalised_text       text        NOT NULL,
  language              text        NOT NULL DEFAULT 'en',
  required_fact_slugs   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  source                text        NOT NULL,             -- template · user_turn · gap_backfill · conversation_followup
  answer_status         text        NOT NULL DEFAULT 'candidate',
  trust                 text        NOT NULL DEFAULT 'unknown',
  reply_kind            text        NULL,
  supporting_fact_refs  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  last_verified_at      timestamptz NULL,
  verification_latency_ms integer   NULL
);

CREATE INDEX IF NOT EXISTS idx_nex_question_variant_domain_status
  ON nex.question_variant (domain, answer_status);

CREATE INDEX IF NOT EXISTS idx_nex_question_variant_domain_entity_intent
  ON nex.question_variant (domain, entity_ref, intent_slug);

CREATE INDEX IF NOT EXISTS idx_nex_question_variant_normalised_lookup
  ON nex.question_variant (domain, language, normalised_text);

CREATE INDEX IF NOT EXISTS idx_nex_question_variant_updated_at
  ON nex.question_variant (updated_at DESC);

COMMENT ON TABLE nex.question_variant IS
  'Founder BEGIN Phase 2 · one row per canonical question variant. Fingerprint dedups. NO composed answer text is stored · answers are composed at read time from required_fact_slugs against the canonical fact store.';

-- ═══════════════════════════════════════════════════════════════════
-- knowledge_gap · durable feedback queue
-- ═══════════════════════════════════════════════════════════════════
-- Unique on (domain · entity_ref · intent_slug) so live-chat + verifier
-- can both idempotently enqueue the same gap; times_seen counts real
-- customer demand for that gap.
CREATE TABLE IF NOT EXISTS nex.knowledge_gap (
  gap_id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                text        NOT NULL,
  entity_ref            text        NOT NULL,
  intent_slug           text        NOT NULL,
  source                text        NOT NULL,             -- live_chat · verifier · conflict_resolver · freshness_worker
  source_conversation_id text       NULL,
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  times_seen            integer     NOT NULL DEFAULT 1,
  resolved_at           timestamptz NULL,
  resolved_by           text        NULL,
  resolution_fact_ref   text        NULL,
  UNIQUE (domain, entity_ref, intent_slug)
);

CREATE INDEX IF NOT EXISTS idx_nex_knowledge_gap_open_priority
  ON nex.knowledge_gap (domain, resolved_at NULLS FIRST, times_seen DESC);

COMMENT ON TABLE nex.knowledge_gap IS
  'Founder BEGIN Phase 2 · durable feedback queue. UNIQUE on (domain, entity_ref, intent_slug) so live-chat and verifier can both enqueue idempotently. times_seen counts customer demand.';

-- ═══════════════════════════════════════════════════════════════════
-- kf_worker_heartbeat · knowledge-factory worker liveness
-- ═══════════════════════════════════════════════════════════════════
-- SEPARATE from public.worker_heartbeats (which is the cloud brain
-- worker heartbeat table). The knowledge-factory workers are a
-- different fleet with different task shapes. Supervisor uses
-- updated_at to detect stale heartbeats — do NOT trust `state` alone.
CREATE TABLE IF NOT EXISTS nex.kf_worker_heartbeat (
  worker_id             text        PRIMARY KEY,
  domain                text        NOT NULL,
  worker_kind           text        NOT NULL,             -- question_generator · question_verifier · gap_resolver · freshness_worker · master_engineer
  state                 text        NOT NULL,             -- RUNNING · IDLE · PAUSED · DEGRADED · FAILED · RECOVERING
  current_task          text        NULL,
  last_success_at       timestamptz NULL,
  last_failure_at       timestamptz NULL,
  last_error            text        NULL,
  tasks_completed       bigint      NOT NULL DEFAULT 0,
  tasks_failed          bigint      NOT NULL DEFAULT 0,
  queue_depth           integer     NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_kf_worker_heartbeat_updated_at
  ON nex.kf_worker_heartbeat (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_kf_worker_heartbeat_domain
  ON nex.kf_worker_heartbeat (domain, worker_kind);

COMMENT ON TABLE nex.kf_worker_heartbeat IS
  'Founder BEGIN Phase 2 · knowledge-factory worker liveness. Supervisor uses updated_at (not state) to detect stale heartbeats.';

-- ═══════════════════════════════════════════════════════════════════
-- category_scorecard · public per-category scorecard cache
-- ═══════════════════════════════════════════════════════════════════
-- One row per domain. Rebuilt by the observatory when read. The row is a
-- cache — the SOURCE of truth is the live COUNT/aggregation over the
-- other tables. Cache exists so the HQ dashboard doesn't run expensive
-- aggregations on every page render.
CREATE TABLE IF NOT EXISTS nex.category_scorecard (
  domain                text        PRIMARY KEY,
  entities              integer     NOT NULL DEFAULT 0,
  canonical_facts       integer     NOT NULL DEFAULT 0,
  question_variants     integer     NOT NULL DEFAULT 0,
  answered              integer     NOT NULL DEFAULT 0,
  partially_answered    integer     NOT NULL DEFAULT 0,
  unknown_count         integer     NOT NULL DEFAULT 0,
  conflicting           integer     NOT NULL DEFAULT 0,
  stale                 integer     NOT NULL DEFAULT 0,
  open_gaps             integer     NOT NULL DEFAULT 0,
  question_variant_target integer   NOT NULL DEFAULT 1000000,
  coverage_pct          numeric(5,2) NOT NULL DEFAULT 0,
  answered_pct          numeric(5,2) NOT NULL DEFAULT 0,
  generation_throughput_per_hour numeric(10,2) NULL,
  verification_throughput_per_hour numeric(10,2) NULL,
  live_chat_deterministic_hit_rate_pct numeric(5,2) NULL,
  live_chat_p50_ms      integer     NULL,
  live_chat_p95_ms      integer     NULL,
  live_chat_p99_ms      integer     NULL,
  last_updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex.category_scorecard IS
  'Founder BEGIN Phase 2 · public per-category scorecard. Cache. Rebuilt on observatory read. Long-term target: 1,000,000+ per active category.';

-- ═══════════════════════════════════════════════════════════════════
-- master_rulebook · persistent mission per domain
-- ═══════════════════════════════════════════════════════════════════
-- One row per domain PLUS one for master_ai_engineer. Every worker
-- consults its category's rulebook every loop iteration. The mission
-- text is the doctrine · the numeric fields are the governors.
CREATE TABLE IF NOT EXISTS nex.master_rulebook (
  domain                text        PRIMARY KEY,
  mission_text          text        NOT NULL,
  question_variant_target integer   NOT NULL DEFAULT 1000000,
  minimum_coverage_pct  numeric(5,2) NOT NULL DEFAULT 80.00,
  duplicate_rate_threshold_pct numeric(5,2) NOT NULL DEFAULT 30.00,
  storage_growth_bytes_per_hour_threshold bigint NOT NULL DEFAULT 104857600,  -- 100 MB/hr
  bounded_retry_max     integer     NOT NULL DEFAULT 5,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex.master_rulebook IS
  'Founder BEGIN Phase 2 · persistent per-category mission. Every worker consults its own rulebook every loop. Also holds the numeric governor thresholds.';
