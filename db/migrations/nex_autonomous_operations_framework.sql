-- db/migrations/nex_autonomous_operations_framework.sql
--
-- NEX Autonomous Operations Framework · Wave A migration
-- Founder-authorised programme · 2026-09-22.
--
-- This migration is ADDITIVE ONLY. It never modifies existing tables
-- (`nex.harvest_job`, `nex.harvest_worker`, `nex.harvest_yield`,
-- `nex.harvest_source`, `nex.harvest_business_candidate`,
-- `nex.discovery_business_evidence`, etc.). The AOF layer sits ABOVE the
-- proven harvest engine — agents are LOGICAL roles that coordinate
-- physical workers, adapters, and governors. Nothing here relaxes any
-- pre-existing doctrine lock.
--
-- Tables introduced:
--   nex.aof_agent             — one row per logical agent role
--   nex.aof_agent_capability  — explicit capability grants (append-only-in-spirit)
--   nex.aof_agent_event       — append-only event log for every state transition
--   nex.aof_source_cooldown   — per-source cooldown state (governor writes)
--   nex.aof_cycle             — one row per orbiting cycle (correlation anchor)
--
-- All timestamps in TIMESTAMPTZ. RLS remains disabled on backend-only
-- coordination tables (Founder decision on nex.harvest_* applies here).

CREATE SCHEMA IF NOT EXISTS nex;

-- ─────────────────────────────────────────────────────────────────────
-- aof_agent · one row per logical agent role
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.aof_agent (
  agent_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name          TEXT NOT NULL UNIQUE,
  agent_role          TEXT NOT NULL,          -- see aof_agent_role_ck
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'registered',
  founder_signed      BOOLEAN NOT NULL DEFAULT FALSE,
  founder_signed_at   TIMESTAMPTZ,
  founder_signed_by   TEXT,
  last_seen_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT aof_agent_status_ck
    CHECK (status IN ('registered','active','paused','stopped','error')),
  CONSTRAINT aof_agent_role_ck
    CHECK (agent_role IN (
      'source_intelligence',
      'rate_governor',
      'country_scheduler',
      'api_adapter_registry',
      'heartbeat_recovery',
      'discovery',
      'website_walk',
      'evidence_audit',
      'orbiting',
      'live_streaming',
      'connections',
      'gate_adapter'
    )),
  CONSTRAINT aof_agent_signed_when_active
    CHECK (status <> 'active' OR (founder_signed = TRUE AND founder_signed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_aof_agent_status ON nex.aof_agent (status);
CREATE INDEX IF NOT EXISTS ix_aof_agent_role ON nex.aof_agent (agent_role);

-- ─────────────────────────────────────────────────────────────────────
-- aof_agent_capability · explicit capability grants
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.aof_agent_capability (
  agent_id            UUID NOT NULL REFERENCES nex.aof_agent(agent_id) ON DELETE CASCADE,
  capability          TEXT NOT NULL,
  scope               JSONB NOT NULL DEFAULT '{}'::JSONB,
  granted_by          TEXT NOT NULL,          -- 'founder' | 'system'
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  PRIMARY KEY (agent_id, capability),
  CONSTRAINT aof_capability_ck
    CHECK (capability IN (
      'source_probe','website_walk','publish_evidence','manage_cooldown',
      'schedule_country','failover_source','recover_worker','emit_heartbeat',
      'stream_events','connect_adapter','audit_evidence','orbit_territories'
    ))
);

CREATE INDEX IF NOT EXISTS ix_aof_capability_by_capability
  ON nex.aof_agent_capability (capability) WHERE revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- aof_agent_event · append-only event log
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.aof_agent_event (
  event_id            BIGSERIAL PRIMARY KEY,
  agent_id            UUID NOT NULL REFERENCES nex.aof_agent(agent_id) ON DELETE CASCADE,
  event_kind          TEXT NOT NULL,
  event_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  worker_id           TEXT,                   -- physical harvest_worker hosting the agent (nullable)
  cycle_id            UUID,                   -- correlate to aof_cycle
  payload             JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT aof_event_kind_ck
    CHECK (event_kind IN (
      'registered','signed','activated','paused','stopped',
      'heartbeat','decision','failover','cooldown_applied',
      'error','audit_pass','audit_fail','cycle_start','cycle_end'
    ))
);

CREATE INDEX IF NOT EXISTS ix_aof_agent_event_agent ON nex.aof_agent_event (agent_id, event_at DESC);
CREATE INDEX IF NOT EXISTS ix_aof_agent_event_kind ON nex.aof_agent_event (event_kind, event_at DESC);
CREATE INDEX IF NOT EXISTS ix_aof_agent_event_cycle ON nex.aof_agent_event (cycle_id, event_at) WHERE cycle_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- aof_source_cooldown · per-source cooldown state
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.aof_source_cooldown (
  source_slug         TEXT PRIMARY KEY REFERENCES nex.harvest_source(source_slug) ON DELETE CASCADE,
  cooldown_until      TIMESTAMPTZ NOT NULL,
  last_failure_kind   TEXT NOT NULL,
  last_failure_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  consecutive_failures INT NOT NULL DEFAULT 0,
  applied_by_agent_id UUID REFERENCES nex.aof_agent(agent_id),
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT aof_cooldown_failure_ck
    CHECK (last_failure_kind IN (
      'rate_limited','source_unavailable','parse_error','network_error',
      'ip_blocked','robots_denied','other'
    ))
);

CREATE INDEX IF NOT EXISTS ix_aof_source_cooldown_until ON nex.aof_source_cooldown (cooldown_until);

-- ─────────────────────────────────────────────────────────────────────
-- aof_cycle · one row per orbiting cycle
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.aof_cycle (
  cycle_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_seq           BIGINT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  ended_kind          TEXT,                   -- 'completed'|'aborted'|'interrupted'
  triggered_by        TEXT NOT NULL,          -- 'orbiting_agent'|'founder_manual'|'cron'
  programme_id        UUID,
  countries_touched   TEXT[],
  sources_attempted   TEXT[],
  sources_succeeded   TEXT[],
  sources_cooled_down TEXT[],
  candidates_added    INT NOT NULL DEFAULT 0,
  walks_completed     INT NOT NULL DEFAULT 0,
  evidence_added      INT NOT NULL DEFAULT 0,
  emails_captured     INT NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT aof_cycle_ended_ck CHECK (ended_kind IS NULL OR ended_kind IN ('completed','aborted','interrupted'))
);

CREATE INDEX IF NOT EXISTS ix_aof_cycle_seq ON nex.aof_cycle (cycle_seq DESC);
CREATE INDEX IF NOT EXISTS ix_aof_cycle_started ON nex.aof_cycle (started_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- aof_cycle_seq · sequence for monotonic cycle_seq
-- ─────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS nex.aof_cycle_seq_seq START 1;

-- ─────────────────────────────────────────────────────────────────────
-- RLS · backend coordination tables · RLS disabled to match harvest_* pattern
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE nex.aof_agent DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.aof_agent_capability DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.aof_agent_event DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.aof_source_cooldown DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.aof_cycle DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- Grants · runtime role (nex_app_runtime) needs CRUD on these tables
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.aof_agent TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.aof_agent_capability TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.aof_agent_event TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.aof_source_cooldown TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.aof_cycle TO nex_app_runtime;
    GRANT USAGE ON SEQUENCE nex.aof_cycle_seq_seq TO nex_app_runtime;
    GRANT USAGE ON SEQUENCE nex.aof_agent_event_event_id_seq TO nex_app_runtime;
  END IF;
END$$;
