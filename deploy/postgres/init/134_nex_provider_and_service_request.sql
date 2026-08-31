-- 134_nex_provider_and_service_request.sql · Philip 2026-08-29
--
-- NEX Mobility Doctrine v2 alignment:
--   · rename driver_profile → provider_profile (via table rename)
--   · leave a backward-compatible VIEW behind so nothing that still says
--     `nex.driver_profile` crashes while the string audit runs
--   · introduce nex.service_request as the core domain object for the
--     Connection State Machine (REQUEST → ACCEPT → CONNECTED → ...
--     → COMPLETED / CANCELLED / FAILED / TIMED_OUT)
--
-- Doctrine anchor: project_nex_mobility_doctrine_2026_08_29.md
-- Locks: never "driver" internally, never "ride" internally, never
--        "book" internally. Provider is a NEX entity, service_request
--        is the interaction.

-- ── 1 · Rename driver_profile → provider_profile ─────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'nex' AND table_name = 'driver_profile')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'nex' AND table_name = 'provider_profile') THEN
    EXECUTE 'ALTER TABLE nex.driver_profile RENAME TO provider_profile';
  END IF;
END $$;

-- Rename its indexes to keep telemetry readable
ALTER INDEX IF EXISTS nex.idx_driver_profile_city_status RENAME TO idx_provider_profile_city_status;
ALTER INDEX IF EXISTS nex.idx_driver_profile_bike_slug   RENAME TO idx_provider_profile_bike_slug;

-- Backward-compatible view so old code paths keep working while the
-- string audit runs. Any old query hitting `nex.driver_profile` gets
-- the same rows via a view. Deprecated · plan to drop when audit done.
CREATE OR REPLACE VIEW nex.driver_profile AS
  SELECT * FROM nex.provider_profile;

COMMENT ON VIEW nex.driver_profile IS
  'DEPRECATED · use nex.provider_profile · view kept for backward compat during Mobility Doctrine rebuild · Philip 2026-08-29 · drop after string audit';

-- Rename the primary key column so callers self-document intent
ALTER TABLE nex.provider_profile RENAME COLUMN driver_id TO provider_id;

-- ── 2 · nex.service_request · the core Connection State Machine object ─
CREATE TABLE IF NOT EXISTS nex.service_request (
  request_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is requesting · anonymous device UUID or authenticated NEX ID
  learner_ref           text NOT NULL,

  -- What they want · v1 = bike service · future: parcel · food · etc.
  service_kind          text NOT NULL DEFAULT 'bike'
                          CHECK (service_kind IN ('bike','parcel','food')),

  -- Where · text destinations for v1 · lat/lng added when geocoding wired
  destination_text      text NOT NULL,
  destination_lat       double precision,
  destination_lng       double precision,
  origin_text           text,
  origin_lat            double precision,
  origin_lng            double precision,

  -- Selected provider · null until provider selected/accepts
  provider_id           uuid REFERENCES nex.provider_profile(provider_id),

  -- Connection State Machine state
  state                 text NOT NULL DEFAULT 'DESTINATION'
                          CHECK (state IN (
                            'DESTINATION',
                            'NETWORK_CHECK',
                            'PROVIDERS',
                            'REQUESTED',
                            'CONNECTED',
                            'APPROACHING',
                            'NEARBY',
                            'SERVICE',
                            'COMPLETED',
                            'CANCELLED_BY_USER',
                            'DECLINED_BY_PROVIDER',
                            'TIMED_OUT',
                            'PROVIDER_LOST_SIGNAL'
                          )),
  state_entered_at      timestamptz NOT NULL DEFAULT now(),

  -- Timestamps per phase · null until entered
  requested_at          timestamptz,
  accepted_at           timestamptz,
  approaching_at        timestamptz,
  nearby_at             timestamptz,
  service_started_at    timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,

  -- Reason on failure · one line, honest
  failure_reason        text,

  -- Ratings (populated in COMPLETED)
  user_rating_of_provider    integer CHECK (user_rating_of_provider BETWEEN 1 AND 5),
  provider_rating_of_user    integer CHECK (provider_rating_of_user BETWEEN 1 AND 5),
  user_rating_note           text,

  -- Never store fabricated distance/duration · only real observations
  actual_distance_m     integer,
  actual_duration_s     integer,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_request_learner_created ON nex.service_request (learner_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_request_provider_state ON nex.service_request (provider_id, state);
CREATE INDEX IF NOT EXISTS idx_service_request_active_state   ON nex.service_request (state)
  WHERE state IN ('REQUESTED','CONNECTED','APPROACHING','NEARBY','SERVICE');

COMMENT ON TABLE nex.service_request IS
  'NEX Mobility Connection State Machine · one row per service request · Philip 2026-08-29 · doctrine: NEX presents providers, user selects, provider accepts, NEX connects · NEX does not dispatch';
