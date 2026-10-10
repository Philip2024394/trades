-- 193_nex_emergency_schema.sql
--
-- NEX Emergency Help · foundation data layer (F4 · 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- NEX Emergency Help is a safety-network pilot (NOT a public-broadcast
-- system). The v1 pilot ships SIMULATED-only: no real alerts leave the
-- system, no real responder notifications fire, no live location
-- tracking. Every row persisted via the v1 code path is tagged
-- `simulated = TRUE`; service-layer writes with `simulated = false` are
-- rejected until the live-mode founder authorisation lands.
--
-- Doctrine (sealed with this migration):
--   · NEVER broadcast to all accounts. Recipients are the resolved set
--     of the three-layer resolver (trusted contacts, nearby opted-in
--     responders, optional wider-community layer). The wider-community
--     layer is DISABLED in v1 by feature flag.
--   · NEVER passively track location. `location_*` columns are
--     populated only at explicit incident-creation time by the
--     requester. `incident_recipient.distance_meters` is derived once
--     at resolve-time and is NEVER updated live.
--   · NEVER auto-opt-in an account as a responder. Opt-in is explicit
--     via `nex.emergency_responder_optin`, and REQUIRES an
--     `acknowledged_safety_guidance_at` timestamp set by the service
--     layer when the owner read the sealed safety brief.
--   · Rate-limited at the service layer: 3 concurrent active incidents
--     per account + 10 incidents per rolling 24h window. The
--     `nex.emergency_rate_limit` table stores the per-account hourly
--     bucket count (keyed by hour) that the service layer sums.
--   · Expiration: incidents default to a 30-minute `expires_at`. A
--     background sweep (not shipped here) transitions `active →
--     expired` when `expires_at` passes with no accepted responders.
--
-- ═══════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. nex.emergency_incident           · one row per help request
-- 2. nex.incident_recipient           · one row per (incident × recipient)
-- 3. nex.emergency_responder_optin    · one row per opted-in account
-- 4. nex.trusted_contact              · (owner × contact) edges
-- 5. nex.emergency_rate_limit         · per-account per-hour counters
--
-- ═══════════════════════════════════════════════════════════════════
-- CROSS-DB IDENTITIES
-- ═══════════════════════════════════════════════════════════════════
--
-- `requester_account_id`, `recipient_account_id`, `account_id`,
-- `owner_account_id`, `contact_account_id` are TEXT soft-references to
-- the Supabase `nex_account.id` UUID. They are NOT FK-enforced here
-- because `nex_account` lives in Supabase, not in `nex_dev`. The
-- service layer validates shape (nex_native/types.NexUuid).
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- All CREATE statements use IF NOT EXISTS. Zero DML. Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE nex.emergency_rate_limit;
--   DROP TABLE nex.trusted_contact;
--   DROP TABLE nex.emergency_responder_optin;
--   DROP TABLE nex.incident_recipient;
--   DROP TABLE nex.emergency_incident;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto: `gen_random_uuid()` (loaded by 058/166).
-- · nex schema already present (loaded by foundation).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Emergency Help foundation. Must only be applied via
-- `scripts/nex-canonical/_apply-migration-193.mjs` with the
-- session-identity gate (`current_database() = 'nex_dev'`).

-- ═══════════════════════════════════════════════════════════════════
-- 1 · nex.emergency_incident
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.emergency_incident (
  incident_id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft reference to Supabase nex_account.id (TEXT; not FK across DBs).
  requester_account_id       text         NOT NULL,

  -- Sealed 6-state lifecycle.
  state                      text         NOT NULL DEFAULT 'draft',

  -- Sealed 4-value category enum.
  category                   text         NOT NULL,

  -- Location captured at incident creation only. Never updated live.
  location_lat               double precision NULL,
  location_lng               double precision NULL,
  location_accuracy_meters   integer      NULL,
  location_captured_at       timestamptz  NULL,

  -- v1 pilot flag. ALWAYS TRUE in v1. Service layer rejects writes
  -- with simulated = false until live-mode founder authorisation.
  simulated                  boolean      NOT NULL DEFAULT TRUE,

  created_at                 timestamptz  NOT NULL DEFAULT now(),
  activated_at               timestamptz  NULL,
  resolved_at                timestamptz  NULL,
  cancelled_at               timestamptz  NULL,

  -- Default 30-minute horizon. Sweep flips active → expired past this.
  expires_at                 timestamptz  NOT NULL DEFAULT (now() + interval '30 minutes'),

  -- ─── CHECKs ──────────────────────────────────────────────────────

  CONSTRAINT ck_ei_state CHECK (state IN (
    'draft',
    'active',
    'responders_assigned',
    'resolved',
    'cancelled',
    'expired'
  )),

  CONSTRAINT ck_ei_category CHECK (category IN (
    'general_assistance',
    'medical_concern',
    'safety_concern',
    'other'
  )),

  CONSTRAINT ck_ei_location_lat CHECK (
    location_lat IS NULL OR (location_lat BETWEEN -90 AND 90)
  ),

  CONSTRAINT ck_ei_location_lng CHECK (
    location_lng IS NULL OR (location_lng BETWEEN -180 AND 180)
  ),

  CONSTRAINT ck_ei_accuracy_nonneg CHECK (
    location_accuracy_meters IS NULL OR location_accuracy_meters >= 0
  ),

  CONSTRAINT ck_ei_expires_after_created CHECK (
    expires_at > created_at
  )
);

-- Hot-path indexes.
--   idx 1 · requester history (listMyIncidents)
--   idx 2 · sweep (state, expires_at) for sweepExpired()
CREATE INDEX IF NOT EXISTS idx_ei_requester_state_created
  ON nex.emergency_incident (requester_account_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ei_state_expires
  ON nex.emergency_incident (state, expires_at);

COMMENT ON TABLE nex.emergency_incident IS
  'NEX Emergency Help · one row per help request. v1 PILOT · simulated=TRUE enforced. Never broadcast to all accounts · recipients resolved via 3-layer resolver.';

COMMENT ON COLUMN nex.emergency_incident.simulated IS
  'v1 PILOT flag · service layer rejects simulated=false until live-mode authorisation lands.';

COMMENT ON COLUMN nex.emergency_incident.location_captured_at IS
  'Timestamp of ONE-OFF location capture at incident creation. NEX never passively tracks location.';

-- ═══════════════════════════════════════════════════════════════════
-- 2 · nex.incident_recipient
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.incident_recipient (
  recipient_id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  incident_id                uuid         NOT NULL
    REFERENCES nex.emergency_incident (incident_id) ON DELETE CASCADE,

  -- Soft reference to Supabase nex_account.id.
  recipient_account_id       text         NOT NULL,

  -- Sealed 3-value recipient layer.
  layer                      text         NOT NULL,

  -- Distance captured at resolve-time. NEVER updated live. May be NULL
  -- when the layer is a trusted contact (distance irrelevant).
  distance_meters            integer      NULL,

  notified_at                timestamptz  NOT NULL DEFAULT now(),

  -- Sealed 4-value response status.
  response_status            text         NOT NULL DEFAULT 'pending',

  responded_at               timestamptz  NULL,

  -- Declared by the responder on accept. 1-480 minutes (8h cap).
  eta_minutes                integer      NULL,

  CONSTRAINT ck_ir_layer CHECK (layer IN (
    'trusted_contact',
    'nearby_opted_in',
    'wider_community'
  )),

  CONSTRAINT ck_ir_response_status CHECK (response_status IN (
    'pending',
    'accepted',
    'declined',
    'withdrawn'
  )),

  CONSTRAINT ck_ir_eta_bounds CHECK (
    eta_minutes IS NULL OR (eta_minutes BETWEEN 1 AND 480)
  ),

  CONSTRAINT ck_ir_distance_nonneg CHECK (
    distance_meters IS NULL OR distance_meters >= 0
  ),

  CONSTRAINT uq_ir_incident_recipient
    UNIQUE (incident_id, recipient_account_id)
);

-- Responder inbox: "which pending alerts do I have?"
CREATE INDEX IF NOT EXISTS idx_ir_recipient_status_notified
  ON nex.incident_recipient (recipient_account_id, response_status, notified_at DESC);

-- Requester live-status: "who has responded to my incident?"
CREATE INDEX IF NOT EXISTS idx_ir_incident_status
  ON nex.incident_recipient (incident_id, response_status);

COMMENT ON TABLE nex.incident_recipient IS
  'Per-(incident × recipient) notification record. distance_meters is derived ONCE at resolve-time and NEVER updated live.';

-- ═══════════════════════════════════════════════════════════════════
-- 3 · nex.emergency_responder_optin
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.emergency_responder_optin (
  account_id                       text         PRIMARY KEY,
  opted_in_at                      timestamptz  NOT NULL DEFAULT now(),

  -- Sealed · owner must have read the safety brief in the last 30 days
  -- before opt-in commits. Service layer enforces the 30-day staleness
  -- window; the DB only guarantees the timestamp is present.
  acknowledged_safety_guidance_at  timestamptz  NOT NULL,

  radius_km                        integer      NOT NULL DEFAULT 5,

  -- v1 PILOT flag · simulated-only.
  simulated                        boolean      NOT NULL DEFAULT TRUE,

  CONSTRAINT ck_ero_radius_bounds CHECK (radius_km BETWEEN 1 AND 25)
);

-- Sweep: "which opted-in responders are active?" (resolver query)
CREATE INDEX IF NOT EXISTS idx_ero_simulated_opted_in
  ON nex.emergency_responder_optin (simulated, opted_in_at);

COMMENT ON TABLE nex.emergency_responder_optin IS
  'NEX Emergency Help · explicit responder opt-in record. NEVER auto-populated. Requires acknowledged_safety_guidance_at (safety brief read within last 30 days · service-layer-enforced).';

-- ═══════════════════════════════════════════════════════════════════
-- 4 · nex.trusted_contact
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.trusted_contact (
  owner_account_id        text         NOT NULL,
  contact_account_id      text         NOT NULL,
  added_at                timestamptz  NOT NULL DEFAULT now(),
  contact_label           text         NULL,

  CONSTRAINT pk_tc_owner_contact
    PRIMARY KEY (owner_account_id, contact_account_id),

  CONSTRAINT ck_tc_no_self_contact
    CHECK (owner_account_id <> contact_account_id),

  CONSTRAINT ck_tc_label_len CHECK (
    contact_label IS NULL
    OR length(contact_label) BETWEEN 1 AND 60
  )
);

-- Per-owner listing hot path.
CREATE INDEX IF NOT EXISTS idx_tc_owner_added
  ON nex.trusted_contact (owner_account_id, added_at DESC);

COMMENT ON TABLE nex.trusted_contact IS
  'NEX Emergency Help · pre-selected trusted contacts. Owner-controlled set used as Layer 1 of the 3-layer recipient resolver.';

-- ═══════════════════════════════════════════════════════════════════
-- 5 · nex.emergency_rate_limit
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.emergency_rate_limit (
  account_id    text         NOT NULL,
  window_start  timestamptz  NOT NULL,
  count         integer      NOT NULL DEFAULT 1,

  CONSTRAINT pk_erl_account_window
    PRIMARY KEY (account_id, window_start),

  CONSTRAINT ck_erl_count_nonneg CHECK (count >= 0)
);

COMMENT ON TABLE nex.emergency_rate_limit IS
  'NEX Emergency Help · per-account per-hour counter. Service-layer sums the last 24 hourly buckets to enforce the 10/day limit; the active-count limit (3 concurrent active incidents) is read directly from emergency_incident.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 193.
-- Downstream (NOT shipped here):
--   · src/lib/nex-native/emergency/* (service layer + resolver + actions)
--   · Settings UI + requester flow + responder alert chat (F5)
--   · Expiration sweep background job (operator-owned)
-- ═══════════════════════════════════════════════════════════════════
