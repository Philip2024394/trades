-- 197_nex_emergency_fanout_audit.sql
--
-- NEX Emergency Help · multi-channel fan-out audit log
-- (L3 · 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Introduces a DEDICATED audit table for the multi-channel fan-out
-- service. Fan-out is high-volume (every state transition on every
-- incident may produce N × channels rows) and must NOT share a table
-- with the slow-cadence reconciler log (`nex.cross_db_reconcile_log`).
--
-- One row is written for every fan-out attempt — whether it succeeds,
-- is honestly blocked (SMS/WhatsApp adapters are not wired in v1), is
-- rate-limited, or skipped. Operator traceability requires that NO
-- attempt disappears without a durable record.
--
-- Doctrine (sealed with this migration):
--   · Idempotency: UNIQUE on `idempotency_key`. A re-run of the same
--     fan-out for the same (incident, transition, channel, recipient)
--     is a no-op at the DB layer — the second insert conflicts and the
--     service treats it as "already attempted".
--   · Simulated by default: v1 PILOT · every row carries simulated=TRUE.
--     Live-mode fan-out requires BOTH `NEX_EMERGENCY_EMAIL_REAL_SEND=true`
--     AND `simulated=false` at the service layer, AND founder sign-off.
--   · Opaque recipients: `recipient_identifier` stores either an opaque
--     account_id (uuid shape) or a SHA-16 hash of the email/phone. We
--     never store the raw plaintext of an email or a phone in this
--     audit log — the hashed form keeps the operator traceability
--     ("yes we attempted contact") without creating a side-channel for
--     plaintext PII to leak through the audit.
--
-- ═══════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. nex.emergency_fanout_log · one row per fan-out attempt
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- CREATE TABLE IF NOT EXISTS. All CREATE INDEX statements use IF NOT
-- EXISTS. Zero DML. Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE IF EXISTS nex.emergency_fanout_log;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · migration 193 applied (nex.emergency_incident must exist as the
--   FK target of incident_id).
-- · pgcrypto · gen_random_uuid().
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-197.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

CREATE TABLE IF NOT EXISTS nex.emergency_fanout_log (
  log_id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  incident_id           uuid         NOT NULL
    REFERENCES nex.emergency_incident (incident_id) ON DELETE CASCADE,

  -- Which incident transition produced this fan-out attempt. Mirrors
  -- the sealed enum in types.ts · widened via DROP+ADD if more
  -- transitions are added later.
  transition            text         NOT NULL,

  -- Which channel was attempted. Email is the only working v1 channel.
  channel               text         NOT NULL,

  -- Opaque identifier: either an account_id (uuid shape) OR the SHA-16
  -- hash of a lower-cased email / normalised phone. Never raw PII.
  recipient_identifier  text         NOT NULL,

  -- Outcome enum. 'ok' = provider accepted the message (or simulated
  -- success logged honestly). 'skipped' = no destination for this
  -- channel. 'honest_blocked' = adapter stub returned ok=false by
  -- design (SMS/WhatsApp in v1). 'rate_limited' = internal rate guard
  -- tripped. 'provider_error' = transport-level failure.
  outcome               text         NOT NULL,

  -- Freeform reason string (adapter-provided or service-provided).
  reason                text         NULL,

  -- The idempotency key the fan-out service used. UNIQUE across the
  -- table so re-runs are safe.
  idempotency_key       text         NOT NULL,

  -- v1 PILOT · defaults to TRUE. Live mode flips this at the service
  -- layer when BOTH env flag AND founder sign-off are present.
  simulated             boolean      NOT NULL DEFAULT TRUE,

  attempted_at          timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT ck_efl_transition CHECK (transition IN (
    'pending_confirmation',
    'active',
    'revoked_within_window',
    'cancelled',
    'resolved'
  )),

  CONSTRAINT ck_efl_channel CHECK (channel IN (
    'email',
    'sms',
    'whatsapp',
    'in_app'
  )),

  CONSTRAINT ck_efl_outcome CHECK (outcome IN (
    'ok',
    'skipped',
    'honest_blocked',
    'rate_limited',
    'provider_error'
  ))
);

-- Idempotency seal · a second attempt with the same key is rejected.
CREATE UNIQUE INDEX IF NOT EXISTS emergency_fanout_log_idem_uq
  ON nex.emergency_fanout_log (idempotency_key);

-- Hot path: "show the fan-out trail for one incident".
CREATE INDEX IF NOT EXISTS emergency_fanout_log_incident_time_idx
  ON nex.emergency_fanout_log (incident_id, attempted_at DESC);

-- Secondary: "how many provider_error rows in the last hour".
CREATE INDEX IF NOT EXISTS emergency_fanout_log_outcome_time_idx
  ON nex.emergency_fanout_log (outcome, attempted_at DESC);

COMMENT ON TABLE nex.emergency_fanout_log IS
  'NEX Emergency Help · multi-channel fan-out audit log. One row per attempt. Idempotency enforced by UNIQUE(idempotency_key). v1 PILOT · simulated=TRUE by default · SMS/WhatsApp attempts are honest_blocked.';

COMMENT ON COLUMN nex.emergency_fanout_log.recipient_identifier IS
  'Opaque recipient id. Either a NEX account_id (uuid) OR SHA-16 hash of a lower-cased email / normalised phone. Never raw PII.';

COMMENT ON COLUMN nex.emergency_fanout_log.simulated IS
  'v1 PILOT flag · live-mode fan-out requires NEX_EMERGENCY_EMAIL_REAL_SEND=true AND simulated=false AND founder sign-off.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 197.
-- Downstream:
--   · src/lib/nex-native/emergency/_fanout-audit-log.ts
--   · src/lib/nex-native/emergency/emergency-notification-service.ts
-- ═══════════════════════════════════════════════════════════════════
