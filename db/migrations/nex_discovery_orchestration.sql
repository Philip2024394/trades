-- NEX World Email Intelligence · Part 7-9 · Orchestration + reaper
-- Founder-authorised programme · Session-3 · 2026-09-21.
--
-- Two-clock discipline preserved:
--   * ORCHESTRATION CLOCK (this table)   · 5-minute cadence · claims bounded work
--   * SOURCE POLITENESS CLOCK (existing)  · per-domain · robots/rate/backoff
--
-- Idempotency: same tick timestamp fired twice → same row · never double-processes.
-- Reaper: stalled cycles + expired claims returned to idle · no permanent fake activity.

BEGIN;

-- ─── 1 · Orchestrator tick (immutable append · idempotent by minute_bucket) ─
--
-- Idempotency: same tick fired twice within the same minute → conflicts on
-- (worker_id, minute_bucket). Second attempt returns the existing row.
-- `minute_bucket` is set by the application (client-side date_trunc) which
-- keeps the constraint IMMUTABLE-safe.
CREATE TABLE IF NOT EXISTS nex.discovery_orchestrator_tick (
  tick_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_seq            BIGINT NOT NULL,
  tick_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  minute_bucket       TIMESTAMPTZ NOT NULL,               -- app-supplied · truncated to minute
  finished_at         TIMESTAMPTZ,
  duration_ms         INTEGER,
  leader              TEXT NOT NULL,
  worker_id           TEXT NOT NULL,

  cycles_planned      INTEGER NOT NULL DEFAULT 0,
  cycles_started      INTEGER NOT NULL DEFAULT 0,
  cycles_skipped      INTEGER NOT NULL DEFAULT 0,
  countries_touched   TEXT[] NOT NULL DEFAULT '{}',
  programmes_touched  TEXT[] NOT NULL DEFAULT '{}',

  reaped_stalled_cycles INTEGER NOT NULL DEFAULT 0,
  reaped_expired_claims INTEGER NOT NULL DEFAULT 0,

  outcome             TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (outcome IN ('in_progress','complete','partial','no_work','superseded')),
  note                TEXT,

  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (worker_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS ix_tick_recent ON nex.discovery_orchestrator_tick (tick_at DESC);

-- ─── 2 · Leader lock (single-writer per tick window) ────────────────
-- One row per (programme, minute_bucket). SELECT ... FOR UPDATE SKIP LOCKED
-- semantics · a second worker attempting the same tick gets 0 rows.
CREATE TABLE IF NOT EXISTS nex.discovery_orchestrator_leader (
  programme_id        UUID NOT NULL REFERENCES nex.discovery_programme(programme_id) ON DELETE CASCADE,
  minute_bucket       TIMESTAMPTZ NOT NULL,
  worker_id           TEXT NOT NULL,
  acquired_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at         TIMESTAMPTZ,
  PRIMARY KEY (programme_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS ix_leader_current ON nex.discovery_orchestrator_leader (programme_id, released_at)
  WHERE released_at IS NULL;

COMMIT;
