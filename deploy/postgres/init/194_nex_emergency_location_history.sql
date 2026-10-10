-- 194_nex_emergency_location_history.sql
--
-- NEX Emergency Help · live-location history (H3 · 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- H3 "Live Location + Capability Doctrine" lands a thin append-only
-- history of GPS updates per active incident. The purpose is to keep
-- `nex.emergency_incident.location_*` columns fresh with the latest
-- known position WITHOUT bloating the incident row with a historical
-- series.
--
-- Doctrine (honest ceiling of a web app · see
-- docs/doctrine/nex-emergency-background-capability-2026-10-10.md):
--   · This is FOREGROUND live-location streaming only. Updates land
--     while the requester's ActiveIncidentView is open in a visible
--     browser tab. There is NO always-on tracking. The phone being
--     powered off produces no row here · that is physically impossible
--     on any platform without a native companion app.
--   · Every row is `simulated = TRUE` in v1 PILOT. The service layer
--     rejects writes with `simulated = false` until live-mode founder
--     authorisation lands.
--   · Rate-limited at the service layer: at most 1 update per 10 s per
--     incident. The DB does NOT enforce rate at the row level; it is
--     the service's responsibility to reject bursts.
--   · Append-only. Rows are never updated after insert. ON DELETE
--     CASCADE from the parent incident so purge paths stay clean.
--   · Writes to this table trigger an in-session UPDATE of the parent
--     `emergency_incident` row's location_* columns so a reader of the
--     incident always sees the latest known location without a JOIN.
--
-- ═══════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. nex.emergency_location_update   · append-only history of GPS pings
--
-- ═══════════════════════════════════════════════════════════════════
-- CROSS-DB IDENTITIES
-- ═══════════════════════════════════════════════════════════════════
--
-- No new soft references here. incident_id is a hard FK to
-- nex.emergency_incident(incident_id), which already lives in nex_dev.
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- CREATE TABLE / CREATE INDEX use IF NOT EXISTS. Zero DML. Safe to
-- re-run. The service-layer UPDATE of the parent incident row is NOT
-- a DB trigger · it is explicit SQL inside the same transaction in
-- `updateIncidentLocation`.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE nex.emergency_location_update;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · migration 193 applied (nex.emergency_incident must exist for FK).
-- · pgcrypto: gen_random_uuid() (loaded by 058/166).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Emergency live-location history. Must only be applied via
-- `scripts/nex-canonical/_apply-migration-194.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

-- ═══════════════════════════════════════════════════════════════════
-- 1 · nex.emergency_location_update
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.emergency_location_update (
  update_id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),

  incident_id        uuid              NOT NULL
    REFERENCES nex.emergency_incident (incident_id) ON DELETE CASCADE,

  lat                double precision  NOT NULL,
  lng                double precision  NOT NULL,
  accuracy_meters    integer           NULL,
  heading_degrees    double precision  NULL,
  speed_mps          double precision  NULL,

  -- Sealed 3-value origin tag.
  source             text              NOT NULL DEFAULT 'browser_watch_position',

  -- v1 PILOT flag. ALWAYS TRUE in v1. Service layer rejects writes
  -- with simulated = false until live-mode founder authorisation.
  simulated          boolean           NOT NULL DEFAULT TRUE,

  -- Timestamp the browser captured the fix (position.timestamp).
  captured_at        timestamptz       NOT NULL,

  -- Timestamp the server accepted the ping.
  received_at        timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT ck_elu_lat     CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT ck_elu_lng     CHECK (lng BETWEEN -180 AND 180),

  CONSTRAINT ck_elu_accuracy_nonneg CHECK (
    accuracy_meters IS NULL OR accuracy_meters >= 0
  ),

  CONSTRAINT ck_elu_heading_bounds CHECK (
    heading_degrees IS NULL OR (heading_degrees BETWEEN 0 AND 360)
  ),

  CONSTRAINT ck_elu_speed_nonneg CHECK (
    speed_mps IS NULL OR speed_mps >= 0
  ),

  CONSTRAINT ck_elu_source CHECK (source IN (
    'browser_watch_position',
    'manual_pin',
    'service_worker_sync'
  ))
);

-- Hot-path index: "latest N pings for an incident, newest first".
CREATE INDEX IF NOT EXISTS emergency_location_update_incident_time_idx
  ON nex.emergency_location_update (incident_id, captured_at DESC);

COMMENT ON TABLE nex.emergency_location_update IS
  'NEX Emergency Help · append-only live-location history. One row per browser watchPosition ping while the requester has the active-incident page open. Service-layer-rate-limited to 1/10s per incident. In v1 PILOT every row is simulated=TRUE.';

COMMENT ON COLUMN nex.emergency_location_update.source IS
  'Where the ping came from: browser_watch_position (default · foreground tab), manual_pin (requester tapped the map), service_worker_sync (periodic-sync wake · heavily throttled by Chrome · deferred no-op in v1).';

COMMENT ON COLUMN nex.emergency_location_update.captured_at IS
  'When the browser captured the GPS fix (position.timestamp). May lag received_at by a few seconds due to transport.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 194.
-- Downstream (NOT shipped here):
--   · src/lib/nex-native/emergency/incident-service.ts :: updateIncidentLocation
--   · src/lib/nex-native/emergency/actions.ts :: updateIncidentLocationAction
--   · src/components/nex-native/emergency/ActiveIncidentView.tsx watchPosition
--   · public/nex-emergency-sw.js scaffold
-- ═══════════════════════════════════════════════════════════════════
