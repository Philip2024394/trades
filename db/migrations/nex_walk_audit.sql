-- db/migrations/nex_walk_audit.sql
--
-- Walk audit trail · behavior-based governance evidence log · 2026-09-23.
-- Founder-authorised: replace host-allowlist with behavior-based governance
-- for walk fetches. Every walk fetch persists a row here for audit.
--
-- ADDITIVE ONLY. Zero modification to existing tables.

CREATE TABLE IF NOT EXISTS nex.walk_audit (
  audit_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  host                TEXT NOT NULL,
  url                 TEXT NOT NULL,
  method              TEXT NOT NULL DEFAULT 'GET'
                        CHECK (method IN ('GET','HEAD')),
  outcome             TEXT NOT NULL
                        CHECK (outcome IN ('responded','blocked_by_robots','blocked_cross_apex_redirect','rate_limited','not_found','unavailable','timeout')),
  status_code         INT,
  bytes               BIGINT NOT NULL DEFAULT 0,
  robots_verdict      TEXT NOT NULL
                        CHECK (robots_verdict IN ('allowed','disallowed','unknown_no_robots','robots_fetch_failed')),
  notes               TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_walk_audit_at
  ON nex.walk_audit (at DESC);

CREATE INDEX IF NOT EXISTS ix_walk_audit_host_at
  ON nex.walk_audit (host, at DESC);

CREATE INDEX IF NOT EXISTS ix_walk_audit_outcome
  ON nex.walk_audit (outcome);

ALTER TABLE nex.walk_audit DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.walk_audit TO nex_app_runtime;
  END IF;
END$$;
