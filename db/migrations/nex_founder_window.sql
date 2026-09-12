-- Founder 2026-09-10 · Founder's Window · production event backbone.
--
-- Append-only event log that unifies signals from every NEX subsystem so
-- the Founder can see the system thinking, researching, verifying, storing,
-- and reporting — in one place, honestly, with zero fake data.
--
-- Design:
--   · Single wide table · every subsystem writes here
--   · Partitioned monthly for cheap retention (optional · not enforced yet)
--   · `event_kind` is TEXT + CHECK constraint so new subsystems can't
--     introduce typos silently
--   · `request_id` allows end-to-end tracing across all 10 pipeline stages
--   · `reference` is JSONB with subsystem-specific fields (row_id, url, etc.)
--   · NEVER updated · NEVER deleted (retention via partition drop only)

CREATE TABLE IF NOT EXISTS nex.founder_window_event (
  event_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  subsystem      TEXT NOT NULL, -- "chat" | "lab_harvest" | "lab_verify" | "master_ai" | "programmer" | "voice" | "ocr" | "mcp" | "storage" | "scheduler" | "notification" | "authorization"
  event_kind     TEXT NOT NULL CHECK (event_kind IN (
    'data_received',
    'input_sanitized',
    'input_rejected',
    'intent_classified',
    'research_started',
    'research_completed',
    'evidence_discovered',
    'evidence_rejected',
    'claim_verified',
    'claim_rejected',
    'knowledge_stored',
    'knowledge_updated',
    'gap_created',
    'gap_resolved',
    'agent_started',
    'agent_completed',
    'agent_failed',
    'scheduled_task_triggered',
    'scheduled_task_completed',
    'notification_generated',
    'action_authorized',
    'action_rejected',
    'subsystem_probe',
    'pipeline_stage_tick'
  )),
  status         TEXT NOT NULL CHECK (status IN ('info','ok','warning','error','critical')),
  request_id     UUID, -- correlation across pipeline stages · NULL if not part of a chat turn
  actor          TEXT, -- agent_id, user_id, or 'system'
  subject_ref    TEXT, -- dedupe_hash, url, business_id, etc. · free-text
  message        TEXT, -- human-readable one-line summary (shown in stream)
  reference      JSONB, -- structured detail
  duration_ms    INTEGER -- optional · when this event closes a start event
);

CREATE INDEX IF NOT EXISTS ix_fwe_emitted_at ON nex.founder_window_event (emitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_fwe_subsystem ON nex.founder_window_event (subsystem, emitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_fwe_kind ON nex.founder_window_event (event_kind, emitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_fwe_status_recent ON nex.founder_window_event (status, emitted_at DESC) WHERE status IN ('error','critical','warning');
CREATE INDEX IF NOT EXISTS ix_fwe_request_id ON nex.founder_window_event (request_id) WHERE request_id IS NOT NULL;

-- Subsystem-probe latest snapshot (denormalised for fast status pill reads)
CREATE TABLE IF NOT EXISTS nex.founder_window_subsystem_status (
  subsystem       TEXT PRIMARY KEY,
  status          TEXT NOT NULL CHECK (status IN ('green','yellow','red','unknown','not_implemented')),
  status_reason   TEXT NOT NULL, -- e.g. "whisper.cpp binary not installed"
  last_ok_at      TIMESTAMPTZ,
  last_probe_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  probe_reference JSONB,
  metrics         JSONB -- e.g. {"rows_written_today": 14, "bytes_used": 18874368}
);

-- Notification pipe · queue of user-facing notifications (email/SMS/WA)
-- Populated by any subsystem · consumed by nex-notifier worker (future BEGIN)
CREATE TABLE IF NOT EXISTS nex.founder_window_notification (
  notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel          TEXT NOT NULL CHECK (channel IN ('log','desktop','email','sms','whatsapp','webhook')),
  severity         TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  event_id         UUID REFERENCES nex.founder_window_event(event_id),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','suppressed')),
  delivered_at     TIMESTAMPTZ,
  suppression_key  TEXT -- dedupe: don't spam identical notifications within TTL
);

CREATE INDEX IF NOT EXISTS ix_fwn_status ON nex.founder_window_notification (status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_fwn_suppression ON nex.founder_window_notification (suppression_key, created_at DESC) WHERE suppression_key IS NOT NULL;
