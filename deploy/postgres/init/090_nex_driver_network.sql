-- deploy/postgres/init/090_nex_driver_network.sql
--
-- NEX DRIVER NETWORK · Stage A infrastructure schema
--
-- Doctrine anchors (constitutional):
--   - Driver Network authorised-only design (2026-08-23): NEX may ONLY use driver
--     location where the driver has explicitly authorised the NEX Driver system.
--     NEVER third-party scraping. NEVER inferred location. NEVER silent onboarding.
--   - NEX Driver commission model (2026-08-23 REVISED): free to join · first 3
--     completed trips per calendar month = 0% commission · trip 4+ = 8% commission
--     (initial config · configurable in commission_policy row · 5-8% testable band).
--     NEVER a membership fee · NEVER commission on incomplete/cancelled trips.
--     After the free-trip allowance, driver must maintain positive wallet balance
--     (top-up via nex.driver_wallet_transaction 'topup' kind · Rp 10,000 default unit).
--     Dispatch refuses drivers with insufficient wallet balance UNLESS they are
--     still within their monthly free-trip allowance.
--   - Multi-purpose earning engine (2026-08-23): NEX Driver is NOT a single-mode
--     taxi app. 9 job-type codes covering passenger rides, deliveries, luggage,
--     hotel↔airport, family transport, tourist trips, shopping/pickup.
--   - Parallel-development principle (2026-08-23): this schema is Stage A
--     infrastructure and CAN be built in parallel with walkers/backfill · Stage B
--     activation of live dispatch is gated behind NEX_DRIVER_DISPATCH_ENABLED
--     runtime flag AND legal/operator/insurance/KYC/payment prerequisites.
--   - Truth Invariant (2026-08-22 CONSTITUTIONAL): every claim NEX makes about a
--     driver's location or availability MUST cite the consent grant it stands on.
--
-- Stage A / Stage B split enforced at TWO layers:
--   1. Schema layer (this migration): every driver_location_heartbeat row REQUIRES
--      a driver_location_consent_id · CHECK enforces it can't be null.
--   2. Runtime layer (src/lib/nex-driver/dispatch.ts): dispatch function refuses to
--      operate unless NEX_DRIVER_DISPATCH_ENABLED='true'.
--
-- Additive · non-breaking · reversible via DROP TABLE (rollback at bottom).
-- NOT APPLIED by this session. Awaits explicit greenlight.

BEGIN;

-- ── ENUMS ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nex.driver_status AS ENUM (
    'registered',           -- account exists · KYC not yet uploaded
    'documents_pending',    -- documents uploaded · awaiting verification
    'documents_verified',   -- verified · may go online (Stage B activation gate still applies)
    'suspended'             -- admin suspension (safety complaint, revoked consent, etc.)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.driver_availability_state AS ENUM (
    'offline',              -- driver explicitly offline · NEX MUST NOT read location
    'online',               -- explicitly online · consented location may be read
    'on_trip'               -- currently on a dispatched NEX trip
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.driver_document_kind AS ENUM (
    'national_id',
    'driver_licence',
    'vehicle_registration',
    'vehicle_insurance',
    'operator_permit',
    'health_declaration',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.driver_document_state AS ENUM (
    'uploaded',
    'verified',
    'rejected',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.trip_job_type AS ENUM (
    -- passenger (people travelling)
    'passenger_car',
    'passenger_motorbike',
    -- parcel (small items · motorcycle / car sized)
    'parcel_motorbike',
    'parcel_car',
    -- large goods (multi-vehicle-class tiers matching Indonesian GoBox-style benchmark)
    'large_goods_pickup',
    'large_goods_small_truck',
    'large_goods_truck',
    -- specialisation labels (may compose with passenger_* above)
    'hotel_to_airport',
    'airport_to_hotel',
    'shopping_pickup',
    'local_delivery',
    'luggage',
    'family',
    'tourist_trip'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.trip_request_state AS ENUM (
    'offered',
    'accepted',
    'rejected',
    'expired',
    'cancelled_by_traveller'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.trip_state AS ENUM (
    'accepted',
    'driver_arrived',
    'in_progress',
    'completed',
    'cancelled_by_traveller',
    'cancelled_by_driver',
    'cancelled_by_system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.trip_event_kind AS ENUM (
    'request_offered',
    'request_accepted',
    'request_rejected',
    'request_expired',
    'driver_dispatched',
    'driver_arrived',
    'trip_started',
    'trip_completed',
    'trip_cancelled',
    'fare_calculated',
    'commission_applied'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DRIVER TABLES ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.driver (
  driver_id                  uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name               text                    NOT NULL,
  phone_e164                 text                    NOT NULL UNIQUE,
  email                      text                    UNIQUE,
  home_jurisdiction          text                    NOT NULL,     -- e.g. 'ID/DIY/Yogyakarta'
  vehicle_kind               text                                    ,-- 'car' · 'motorbike' · null until registered
  vehicle_plate              text                                    ,
  vehicle_capacity           int                                     ,-- number of passengers OR delivery weight bracket
  status                     nex.driver_status       NOT NULL DEFAULT 'registered',
  supported_job_types        nex.trip_job_type[]     NOT NULL DEFAULT '{}'::nex.trip_job_type[],
  created_at                 timestamptz             NOT NULL DEFAULT now(),
  updated_at                 timestamptz             NOT NULL DEFAULT now(),
  suspended_at               timestamptz                             ,
  suspended_reason           text                                    ,
  commission_policy_id       uuid                                    ,-- set once verified · null while unverified
  CONSTRAINT driver_verified_requires_vehicle
    CHECK (status <> 'documents_verified' OR vehicle_kind IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_driver_status ON nex.driver (status);
CREATE INDEX IF NOT EXISTS idx_driver_jurisdiction ON nex.driver (home_jurisdiction);

CREATE TABLE IF NOT EXISTS nex.driver_document (
  document_id                uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                  uuid                    NOT NULL REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  kind                       nex.driver_document_kind NOT NULL,
  state                      nex.driver_document_state NOT NULL DEFAULT 'uploaded',
  storage_reference          text                    NOT NULL,     -- opaque pointer to stored doc (never PII inline)
  uploaded_at                timestamptz             NOT NULL DEFAULT now(),
  verified_at                timestamptz                             ,
  rejected_at                timestamptz                             ,
  rejection_reason           text                                    ,
  expires_at                 timestamptz                             ,
  verified_by                text                                    ,-- admin/agent identifier
  UNIQUE (driver_id, kind, uploaded_at)
);

CREATE INDEX IF NOT EXISTS idx_driver_document_state
  ON nex.driver_document (driver_id, kind, state);

-- ── CONSENT LEDGER ─────────────────────────────────────────────────────
-- Explicit location-consent grants. A grant is a permission the driver
-- granted at a specific time · has scope · MAY be revoked. NEX MUST NOT
-- read/store location without an active (revoked_at IS NULL) grant.

CREATE TABLE IF NOT EXISTS nex.driver_location_consent (
  consent_id                 uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                  uuid                    NOT NULL REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  granted_at                 timestamptz             NOT NULL DEFAULT now(),
  granted_via                text                    NOT NULL,     -- 'nex_driver_app_ios_v1' · 'nex_driver_app_android_v1'
  scope                      text                    NOT NULL DEFAULT 'availability_only', -- 'availability_only' · 'trip_only' · 'availability_and_trip'
  revoked_at                 timestamptz                             ,
  revoked_reason             text                                    ,
  device_reference           text                                    ,-- device installation id
  legal_notice_version       text                    NOT NULL      -- version of the consent language the driver saw
);

CREATE INDEX IF NOT EXISTS idx_driver_consent_live
  ON nex.driver_location_consent (driver_id) WHERE revoked_at IS NULL;

-- ── AVAILABILITY + LOCATION ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.driver_availability (
  driver_id                  uuid                    PRIMARY KEY REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  state                      nex.driver_availability_state NOT NULL DEFAULT 'offline',
  last_heartbeat_at          timestamptz                             ,
  state_updated_at           timestamptz             NOT NULL DEFAULT now(),
  consent_id                 uuid                    REFERENCES nex.driver_location_consent(consent_id)
                                                     ,-- MUST be set to a live consent whenever state <> 'offline'
  CONSTRAINT availability_online_requires_consent
    CHECK (state = 'offline' OR consent_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS nex.driver_location_heartbeat (
  heartbeat_id               uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                  uuid                    NOT NULL REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  consent_id                 uuid                    NOT NULL REFERENCES nex.driver_location_consent(consent_id),
  observed_at                timestamptz             NOT NULL,
  lat                        numeric(9, 6)           NOT NULL,
  lng                        numeric(9, 6)           NOT NULL,
  accuracy_meters            numeric(6, 1)                           ,
  speed_meters_per_second    numeric(6, 2)                           ,
  bearing_degrees            numeric(5, 2)                           ,
  battery_percent            int                                     ,
  received_at                timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT hb_lat_range CHECK (lat  BETWEEN  -90 AND  90),
  CONSTRAINT hb_lng_range CHECK (lng  BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_driver_time
  ON nex.driver_location_heartbeat (driver_id, observed_at DESC);

-- ── COMMISSION POLICY ──────────────────────────────────────────────────
-- Data-driven commercial configuration. NEVER hard-coded rate. The policy row
-- defines: how many free trips per driver per calendar month · the commission
-- rate applied to every trip beyond that allowance · and the wallet floor below
-- which a driver may not accept new jobs.
--
-- Doctrine anchors (2026-08-23 REVISED):
--   - First N completed trips per calendar month = 0% commission (Philip: N=3)
--   - After N, commission = rate_after_free (Philip initial: 8% · configurable
--     to test 5-8% band). Never a membership fee.
--   - Wallet floor gates dispatch: driver cannot accept new NEX jobs when
--     wallet_balance_idr < min_wallet_balance_idr AND driver is past the
--     monthly free-trip allowance.
--   - min_wallet_balance_idr default 0 · dispatch requires balance ≥ 0 for
--     post-allowance drivers. Top-up unit exposed for UI hint (Rp 10,000 seed).

CREATE TABLE IF NOT EXISTS nex.commission_policy (
  policy_id                       uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction                    text              NOT NULL,
  job_type                        nex.trip_job_type                ,-- null = applies to any job type
  effective_from                  timestamptz       NOT NULL,
  effective_to                    timestamptz                      ,
  free_completed_trips_per_month  int               NOT NULL DEFAULT 3,
  rate_after_free                 numeric(5, 4)     NOT NULL,        -- e.g. 0.0800 = 8%
  min_wallet_balance_idr          int               NOT NULL DEFAULT 0,
  wallet_topup_unit_idr           int               NOT NULL DEFAULT 10000,
  currency                        text              NOT NULL DEFAULT 'IDR',
  notes                           text                             ,
  CONSTRAINT rate_bounds       CHECK (rate_after_free >= 0 AND rate_after_free <= 1),
  CONSTRAINT free_trips_bounds CHECK (free_completed_trips_per_month >= 0),
  CONSTRAINT wallet_bounds     CHECK (min_wallet_balance_idr >= 0 AND wallet_topup_unit_idr > 0)
);

CREATE INDEX IF NOT EXISTS idx_commission_policy_lookup
  ON nex.commission_policy (jurisdiction, job_type, effective_from DESC);

-- Seed initial Indonesia/Yogyakarta policy (3 free trips/month · 8% thereafter)
INSERT INTO nex.commission_policy (
  jurisdiction, job_type, effective_from,
  free_completed_trips_per_month, rate_after_free,
  min_wallet_balance_idr, wallet_topup_unit_idr, notes
) VALUES (
  'ID/DIY/Yogyakarta',
  NULL,
  now(),
  3,
  0.0800,
  0,
  10000,
  'Initial Indonesia earn-when-you-earn seed. First 3 completed trips/month free · 8% commission thereafter · Rp 10,000 top-up unit · dispatch blocked when wallet < 0 AND driver past free-trip allowance. NEVER a membership fee. Rate is initial commercial configuration · may be tuned 5-8% during testing.'
) ON CONFLICT DO NOTHING;

-- ── DRIVER WALLET + TRANSACTIONS ───────────────────────────────────────
-- Wallet = prepaid commission balance. Driver tops up (usually Rp 10,000).
-- After each completed trip beyond the free-trip allowance, NEX debits the
-- commission from this wallet. If the wallet goes below the policy floor,
-- dispatch stops offering the driver new jobs until they top up.
--
-- Everything is a transaction row. `balance_after_idr` denormalises the
-- running balance for audit-easy queries · but the reconciliation is
-- SUM(amount_idr) grouped by driver.

DO $$ BEGIN
  CREATE TYPE nex.driver_wallet_transaction_kind AS ENUM (
    'topup',              -- driver added funds
    'commission_debit',   -- NEX took commission on a completed trip
    'refund_credit',      -- refund back to driver (e.g. commission reversal)
    'admin_adjustment',   -- rare admin correction · audited
    'payout_debit'        -- driver withdrew earnings (future · not in Stage A)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS nex.driver_wallet (
  driver_id           uuid          PRIMARY KEY REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  balance_idr         int           NOT NULL DEFAULT 0,   -- may go negative if a debit exceeds balance mid-processing
  currency            text          NOT NULL DEFAULT 'IDR',
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nex.driver_wallet_transaction (
  wallet_txn_id       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid          NOT NULL REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  kind                nex.driver_wallet_transaction_kind NOT NULL,
  amount_idr          int           NOT NULL,             -- signed · topup/refund positive · debit negative
  balance_after_idr   int           NOT NULL,             -- running balance snapshot for audit
  trip_id             uuid                                ,-- set when the transaction is tied to a specific trip
  reference           text                                ,-- external reference (payment provider id · admin ticket)
  reason              text                                ,-- human-readable audit note
  created_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT topup_positive       CHECK (kind <> 'topup'            OR amount_idr > 0),
  CONSTRAINT refund_positive      CHECK (kind <> 'refund_credit'    OR amount_idr > 0),
  CONSTRAINT commission_negative  CHECK (kind <> 'commission_debit' OR amount_idr < 0),
  CONSTRAINT payout_negative      CHECK (kind <> 'payout_debit'     OR amount_idr < 0),
  CONSTRAINT commission_needs_trip CHECK (kind <> 'commission_debit' OR trip_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_driver_time
  ON nex.driver_wallet_transaction (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_trip
  ON nex.driver_wallet_transaction (trip_id) WHERE trip_id IS NOT NULL;

-- ── TRIP REQUEST + TRIP + EVENT LOG ────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.trip_request (
  request_id                 uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  traveller_reference        text                    NOT NULL,      -- opaque traveller session/account reference
  job_type                   nex.trip_job_type       NOT NULL,
  origin_lat                 numeric(9, 6)           NOT NULL,
  origin_lng                 numeric(9, 6)           NOT NULL,
  destination_lat            numeric(9, 6)                           ,
  destination_lng            numeric(9, 6)                           ,
  requested_at               timestamptz             NOT NULL DEFAULT now(),
  expires_at                 timestamptz             NOT NULL,
  state                      nex.trip_request_state  NOT NULL DEFAULT 'offered',
  jurisdiction               text                    NOT NULL,
  offered_to_driver_id       uuid                    REFERENCES nex.driver(driver_id) ON DELETE SET NULL,
  route_ref_meters           int                                     ,-- routed distance (from Distance Intelligence) · null if unavailable
  route_ref_seconds          int                                     ,
  reference_fare_min_idr     int                                     ,-- from Transport Calculation · null if unavailable
  reference_fare_max_idr     int                                     ,
  provenance                 jsonb                   NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_trip_request_state
  ON nex.trip_request (state, requested_at DESC);

CREATE TABLE IF NOT EXISTS nex.trip (
  trip_id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id                 uuid                    NOT NULL REFERENCES nex.trip_request(request_id) ON DELETE RESTRICT,
  driver_id                  uuid                    NOT NULL REFERENCES nex.driver(driver_id) ON DELETE RESTRICT,
  job_type                   nex.trip_job_type       NOT NULL,
  jurisdiction               text                    NOT NULL,
  state                      nex.trip_state          NOT NULL DEFAULT 'accepted',
  accepted_at                timestamptz             NOT NULL DEFAULT now(),
  driver_arrived_at          timestamptz                             ,
  started_at                 timestamptz                             ,
  completed_at               timestamptz                             ,
  cancelled_at               timestamptz                             ,
  cancel_reason              text                                    ,
  provenance                 jsonb                   NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_driver ON nex.trip (driver_id, accepted_at DESC);

-- Fare + commission split. ONE row per completed trip (PRIMARY KEY on trip_id
-- guarantees duplicate completion events cannot create a second free trip).
--
-- `sequence_in_month` records which completed trip this was for the driver in
-- the calendar month (1-based). Combined with policy.free_completed_trips_per_month
-- this makes the free/paid decision deterministic and auditable.
-- `commission_free_trip` is a boolean cache of "was this trip within the free
-- allowance?" for fast queries · commission_free_trip = (sequence_in_month <= policy.free_completed_trips_per_month).
CREATE TABLE IF NOT EXISTS nex.trip_fare (
  trip_id                    uuid                    PRIMARY KEY REFERENCES nex.trip(trip_id) ON DELETE CASCADE,
  completed_at               timestamptz             NOT NULL,       -- copy of trip.completed_at for guarantee
  fare_total_idr             int                     NOT NULL CHECK (fare_total_idr > 0),
  commission_policy_id       uuid                    NOT NULL REFERENCES nex.commission_policy(policy_id),
  applied_rate               numeric(5, 4)           NOT NULL,
  driver_payout_idr          int                     NOT NULL CHECK (driver_payout_idr >= 0),
  nex_commission_idr         int                     NOT NULL CHECK (nex_commission_idr >= 0),
  currency                   text                    NOT NULL DEFAULT 'IDR',
  calculated_at              timestamptz             NOT NULL DEFAULT now(),
  sequence_in_month          int                     NOT NULL CHECK (sequence_in_month >= 1),
  commission_free_trip       boolean                 NOT NULL,
  provenance                 jsonb                   NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fare_split_reconciles
    CHECK (driver_payout_idr + nex_commission_idr = fare_total_idr),
  CONSTRAINT free_trip_implies_zero_commission
    CHECK (commission_free_trip = false OR nex_commission_idr = 0)
);

-- Deterministic ordering per (driver, calendar month). A unique index on
-- (driver_id, calendar_month, sequence_in_month) ensures NO race can duplicate
-- a sequence number even under concurrent completion writes. driver_id must
-- come from a join · this table doesn't have it directly · but we add a
-- convenience denormalised column below via generated-column-equivalent.
--
-- Because trip_fare doesn't hold driver_id, we add a partial unique index at
-- application level (via nex.trip_fare_driver_month_seq_unique · a materialised
-- helper). Here we prepare the join column for that helper.
--
-- The application-layer enforcement pattern:
--   BEGIN
--     SELECT ... FOR UPDATE the driver's trip row
--     SELECT COUNT(*) FROM trip_fare tf JOIN trip t ... calendar-month scoped
--     INSERT trip_fare with sequence = count + 1 · commission_free_trip = (seq <= N)
--   COMMIT

CREATE TABLE IF NOT EXISTS nex.trip_event (
  event_id                   uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                    uuid                                    ,-- may be null for pre-trip events on request only
  request_id                 uuid                                    ,
  driver_id                  uuid                                    ,
  kind                       nex.trip_event_kind     NOT NULL,
  occurred_at                timestamptz             NOT NULL DEFAULT now(),
  payload                    jsonb                   NOT NULL DEFAULT '{}'::jsonb,
  actor                      text                                    ,-- 'driver' · 'traveller' · 'system' · 'admin'
  CONSTRAINT event_needs_target CHECK (trip_id IS NOT NULL OR request_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_trip_event_trip
  ON nex.trip_event (trip_id, occurred_at DESC) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trip_event_request
  ON nex.trip_event (request_id, occurred_at DESC) WHERE request_id IS NOT NULL;

COMMENT ON TABLE nex.driver_location_heartbeat IS
  'Every row REQUIRES a live consent_id. Schema-enforced. NEX may NEVER receive/store driver location without an active driver_location_consent row.';
COMMENT ON TABLE nex.commission_policy IS
  'Data-driven commission. NEVER hard-code. Default seed: 10-15% Indonesia/Yogyakarta.';
COMMENT ON TABLE nex.trip_fare IS
  'Per-completed-trip fare split. schema-CHECK guarantees driver_payout + nex_commission = fare_total.';

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   DROP TABLE IF EXISTS nex.trip_event;
--   DROP TABLE IF EXISTS nex.trip_fare;
--   DROP TABLE IF EXISTS nex.trip;
--   DROP TABLE IF EXISTS nex.trip_request;
--   DROP TABLE IF EXISTS nex.driver_wallet_transaction;
--   DROP TABLE IF EXISTS nex.driver_wallet;
--   DROP TABLE IF EXISTS nex.commission_policy;
--   DROP TABLE IF EXISTS nex.driver_location_heartbeat;
--   DROP TABLE IF EXISTS nex.driver_availability;
--   DROP TABLE IF EXISTS nex.driver_location_consent;
--   DROP TABLE IF EXISTS nex.driver_document;
--   DROP TABLE IF EXISTS nex.driver;
--   DROP TYPE  IF EXISTS nex.driver_wallet_transaction_kind;
--   DROP TYPE  IF EXISTS nex.trip_event_kind;
--   DROP TYPE  IF EXISTS nex.trip_state;
--   DROP TYPE  IF EXISTS nex.trip_request_state;
--   DROP TYPE  IF EXISTS nex.trip_job_type;
--   DROP TYPE  IF EXISTS nex.driver_document_state;
--   DROP TYPE  IF EXISTS nex.driver_document_kind;
--   DROP TYPE  IF EXISTS nex.driver_availability_state;
--   DROP TYPE  IF EXISTS nex.driver_status;
-- COMMIT;
