-- NEX Managed Email Marketing · Stage 2 · Sender Pool schema
-- Founder-authorised programme (three-lane operating doctrine 2026-09-21 · ADR-0003a Accepted).
--
-- ROLE
--   Canonical production model for member/founder/auto authorised sender identities.
--   Shared by all three lanes (AUTO · MEMBER · FOUNDER). One production table.
--
-- DOCTRINE HARD-LOCKS (from ADR-0003a Clauses 4·8·9·10):
--   • Every sender must be legitimately authorised + provider-authenticated
--   • Sender pool NEVER used to evade provider limits (Clause 8)
--   • Provider terms + sending limits are external hard constraints (Clause 10)
--   • Capacity source + last-verified-at recorded per sender (never hard-code assumed limits)
--
-- CONCURRENCY
--   Multi-worker safe via UNIQUE (sender_id, window_kind, window_start) + optimistic
--   conditional INSERT ... ON CONFLICT DO UPDATE. Two workers cannot double-consume
--   the same finite capacity because the UPDATE has a WHERE clause bounded by the limit.
--
-- LANES
--   lane='auto'     · member_id IS NULL          · sender authorised for autonomous NEX campaigns
--   lane='member'   · member_id=<uuid>           · sender member-authorised · strictly scoped to that member
--   lane='founder'  · member_id IS NULL          · founder-authorised sender for manual campaigns

BEGIN;

-- ─── Sender identity · one row per authorised sender ────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_sender_identity (
  sender_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                  UUID NULL,                -- NULL for AUTO + FOUNDER lanes · required for MEMBER
  lane                       TEXT NOT NULL
                             CHECK (lane IN ('auto','member','founder')),

  -- Identity
  email                      TEXT NOT NULL,
  display_name               TEXT,
  reply_to                   TEXT,
  sending_domain             TEXT,

  -- Provider
  provider                   TEXT NOT NULL
                             CHECK (provider IN ('resend','sendgrid','ses','mailgun','postmark','smtp-generic')),
  provider_account_ref       TEXT,                     -- opaque reference into secret store · NOT the credential itself

  -- Authentication / verification (Clause 9)
  authentication_state       TEXT NOT NULL DEFAULT 'pending'
                             CHECK (authentication_state IN ('pending','verified','expired','failed')),
  verification_state         TEXT NOT NULL DEFAULT 'unverified'
                             CHECK (verification_state IN ('unverified','domain_pending','domain_verified','oauth_verified','dashboard_delegated','failed')),
  authentication_expires_at  TIMESTAMPTZ NULL,

  -- Capacity (Clause 10 · provider-authorised · NEVER hard-coded assumption)
  daily_capacity             INTEGER,
  hourly_capacity            INTEGER,
  capacity_source            TEXT,                     -- e.g. 'resend-dashboard' · 'ses-console' · 'founder-recorded' · 'provider-doc-<date>'
  capacity_verified_at       TIMESTAMPTZ,

  -- Health (Stage 2 · 8-state vocabulary)
  health_state               TEXT NOT NULL DEFAULT 'healthy'
                             CHECK (health_state IN (
                               'healthy','limited','warning','paused',
                               'authentication_required','provider_blocked','reputation_protection','disabled'
                             )),
  paused_reason              TEXT,

  -- Observability signals
  last_send_at               TIMESTAMPTZ,
  last_event_at              TIMESTAMPTZ,
  last_failure_at            TIMESTAMPTZ,
  last_failure_reason        TEXT,
  bounce_rate                NUMERIC(5,4),             -- 0.0000..1.0000
  complaint_rate             NUMERIC(5,4),

  -- Provenance (Clause 4/9 · authorisation trail)
  authorised_at              TIMESTAMPTZ,
  authorised_by              TEXT,                     -- 'member:<uuid>' · 'founder' · 'system:auto-lane'
  provenance                 JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Structural constraints
  CHECK (
    (lane = 'member' AND member_id IS NOT NULL) OR
    (lane IN ('auto','founder') AND member_id IS NULL)
  )
);

-- One row per (LOWER(email), provider) · functional index cannot live inside
-- a table-level UNIQUE constraint in Postgres · expressed as a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sender_email_provider
  ON nex.marketing_sender_identity (LOWER(email), provider);

CREATE INDEX IF NOT EXISTS ix_sender_lane_health
  ON nex.marketing_sender_identity (lane, health_state)
  WHERE authentication_state = 'verified';

CREATE INDEX IF NOT EXISTS ix_sender_member
  ON nex.marketing_sender_identity (member_id)
  WHERE member_id IS NOT NULL;

-- ─── Capacity windows · concurrency-safe increment ──────────────────
-- One row per (sender, window_kind, window_start) · rolling hour + rolling day
CREATE TABLE IF NOT EXISTS nex.marketing_sender_capacity_window (
  sender_id      UUID NOT NULL REFERENCES nex.marketing_sender_identity(sender_id) ON DELETE CASCADE,
  window_kind    TEXT NOT NULL CHECK (window_kind IN ('hour','day')),
  window_start   TIMESTAMPTZ NOT NULL,
  send_count     INTEGER NOT NULL DEFAULT 0 CHECK (send_count >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_id, window_kind, window_start)
);

CREATE INDEX IF NOT EXISTS ix_sender_capacity_lookup
  ON nex.marketing_sender_capacity_window (sender_id, window_kind, window_start DESC);

-- ─── Audit trail · every material state transition ──────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_sender_audit (
  audit_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID NOT NULL REFERENCES nex.marketing_sender_identity(sender_id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL
                 CHECK (event_type IN (
                   'created','authorised','verification_completed','authentication_changed',
                   'capacity_changed','health_changed','paused','resumed','blocked','disabled',
                   'send_attributed','provider_failure','reputation_protection_activated',
                   'reputation_protection_cleared'
                 )),
  from_state     JSONB,
  to_state       JSONB,
  actor          TEXT NOT NULL,                        -- 'member:<uuid>' · 'founder' · 'system:health-engine' · 'worker:<id>'
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  at_iso         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sender_audit_by_sender
  ON nex.marketing_sender_audit (sender_id, at_iso DESC);

CREATE INDEX IF NOT EXISTS ix_sender_audit_by_type
  ON nex.marketing_sender_audit (event_type, at_iso DESC);

COMMIT;
