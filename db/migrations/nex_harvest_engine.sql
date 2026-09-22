-- ═══════════════════════════════════════════════════════════════════
-- NEX 24/7 World Harvest Engine · Wave H1 · Durable Work Queue
-- Founder-authorised programme · 2026-09-22.
--
-- Postgres is the authority. A process restart must NOT erase work.
-- Every job is durable, leased, heart-beated, retry-tracked, and
-- terminates in either `completed` or `dead_letter`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE SCHEMA IF NOT EXISTS nex;

-- ─── Harvest job queue ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.harvest_job (
  job_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type            TEXT NOT NULL,                    -- source_probe / candidate_walk / website_walk / entity_resolve / email_extract
  programme_id        UUID,                             -- optional link to nex.discovery_programme
  country_iso         TEXT,
  source_id           TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','claimed','processing','completed','failed','dead_letter')),
  priority            INT NOT NULL DEFAULT 100,        -- higher = more urgent
  attempts            INT NOT NULL DEFAULT 0,
  max_attempts        INT NOT NULL DEFAULT 5,
  next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner         TEXT,                             -- worker_id
  lease_acquired_at   TIMESTAMPTZ,
  lease_expires_at    TIMESTAMPTZ,
  heartbeat_at        TIMESTAMPTZ,
  last_error          TEXT,
  last_error_at       TIMESTAMPTZ,
  dead_letter_reason  TEXT,
  dead_letter_at      TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  parent_job_id       UUID REFERENCES nex.harvest_job(job_id),  -- provenance chain
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: one canonical job per (job_type, idempotency_key)
CREATE UNIQUE INDEX IF NOT EXISTS ux_harvest_job_idempotency
  ON nex.harvest_job (job_type, idempotency_key);

-- Fast claim: (queued, priority DESC, next_attempt_at ASC)
CREATE INDEX IF NOT EXISTS ix_harvest_job_claim
  ON nex.harvest_job (status, priority DESC, next_attempt_at ASC)
  WHERE status = 'queued';

-- Reaper: expired leases
CREATE INDEX IF NOT EXISTS ix_harvest_job_expired_leases
  ON nex.harvest_job (lease_expires_at)
  WHERE lease_owner IS NOT NULL AND status IN ('claimed','processing');

-- Programme/country scoping
CREATE INDEX IF NOT EXISTS ix_harvest_job_programme_country
  ON nex.harvest_job (programme_id, country_iso, status);

-- Governance: enforce lease_owner presence when status is claimed/processing
ALTER TABLE nex.harvest_job DROP CONSTRAINT IF EXISTS ck_harvest_job_lease_matches_status;
ALTER TABLE nex.harvest_job ADD CONSTRAINT ck_harvest_job_lease_matches_status
  CHECK (
    (status IN ('claimed','processing') AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status IN ('queued','completed','failed','dead_letter'))
  );

-- Governance: dead_letter must carry a reason
ALTER TABLE nex.harvest_job DROP CONSTRAINT IF EXISTS ck_harvest_job_dead_letter_has_reason;
ALTER TABLE nex.harvest_job ADD CONSTRAINT ck_harvest_job_dead_letter_has_reason
  CHECK (
    status <> 'dead_letter' OR (dead_letter_reason IS NOT NULL AND dead_letter_at IS NOT NULL)
  );

-- ─── Worker heartbeat ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.harvest_worker (
  worker_id                    TEXT PRIMARY KEY,
  host_identifier              TEXT,
  job_type_scope               TEXT[] NOT NULL DEFAULT '{}',
  status                       TEXT NOT NULL DEFAULT 'alive'
                                 CHECK (status IN ('alive','expired','drained')),
  started_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_interval_seconds   INT NOT NULL DEFAULT 30,
  expected_expiry_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 minutes'),
  jobs_claimed                 BIGINT NOT NULL DEFAULT 0,
  jobs_completed               BIGINT NOT NULL DEFAULT 0,
  jobs_failed                  BIGINT NOT NULL DEFAULT 0,
  metadata                     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_harvest_worker_expiring
  ON nex.harvest_worker (expected_expiry_at)
  WHERE status = 'alive';

-- ─── Yield ledger (evidence of real work) ──────────────────────────
CREATE TABLE IF NOT EXISTS nex.harvest_yield (
  yield_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES nex.harvest_job(job_id) ON DELETE CASCADE,
  worker_id    TEXT,
  yield_kind   TEXT NOT NULL,          -- business_candidate / website_walked / email_captured / entity_resolved
  yield_count  INT NOT NULL DEFAULT 1,
  yield_meta   JSONB NOT NULL DEFAULT '{}'::jsonb,
  yielded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_harvest_yield_recent
  ON nex.harvest_yield (yielded_at DESC);

CREATE INDEX IF NOT EXISTS ix_harvest_yield_by_kind
  ON nex.harvest_yield (yield_kind, yielded_at DESC);

CREATE INDEX IF NOT EXISTS ix_harvest_yield_by_job
  ON nex.harvest_yield (job_id);

-- ─── Updated-at trigger for harvest_job ────────────────────────────
CREATE OR REPLACE FUNCTION nex.tg_harvest_job_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS harvest_job_touch ON nex.harvest_job;
CREATE TRIGGER harvest_job_touch
  BEFORE UPDATE ON nex.harvest_job
  FOR EACH ROW EXECUTE FUNCTION nex.tg_harvest_job_touch();

COMMIT;
