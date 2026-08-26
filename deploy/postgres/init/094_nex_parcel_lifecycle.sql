-- deploy/postgres/init/094_nex_parcel_lifecycle.sql
--
-- PARCEL DELIVERY LIFECYCLE + CHAIN OF CUSTODY
--
-- Doctrine anchors:
--   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): GPS never proves
--     delivery. The recipient_confirmed event (OTP / photo / signature) is
--     what establishes the delivery.
--   - Truth Invariant (2026-08-22): every state transition and evidence event
--     is a row · never rewritten · always auditable.
--   - Trip lifecycle is SEPARATE from parcel lifecycle. A parcel delivery may
--     ride on a trip · but its own state machine governs pickup + handover +
--     recipient confirmation.
--
-- Additive · unapplied · reversible.

BEGIN;

-- ── ENUMS ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nex.parcel_state AS ENUM (
    'created',
    'matching',
    'driver_accepted',
    'driver_arrived_pickup',
    'parcel_picked_up',
    'in_transit',
    'arrived_destination',
    'recipient_confirmed',
    'completed',
    -- terminals
    'cancelled_by_sender',
    'cancelled_by_driver',
    'cancelled_by_system',
    'refused_by_recipient',
    'lost',
    'damaged'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.parcel_event_kind AS ENUM (
    'pickup_photo_captured',
    'handover_confirmed_by_sender',
    'recipient_otp_verified',
    'recipient_signature_captured',
    'recipient_photo_captured',
    'gps_observation',      -- supporting evidence · NEVER promotes state
    'issue_reported',
    'lost_reported',
    'damaged_reported'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PARCEL DELIVERY ────────────────────────────────────────────────────
-- One row per parcel delivery. May reference a trip (when the parcel travelled
-- as part of a NEX trip) but need not · a courier operator may have its own
-- lifecycle without a passenger trip.

CREATE TABLE IF NOT EXISTS nex.parcel_delivery (
  parcel_id                 uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                   uuid                                            ,-- FK-style to nex.trip (optional)
  driver_id                 uuid                                            ,-- FK-style to nex.driver (set on driver_accepted)
  sender_reference          text                       NOT NULL,
  sender_contact_phone_e164 text                       NOT NULL,
  recipient_name            text                       NOT NULL,
  recipient_contact_phone_e164 text                    NOT NULL,
  pickup_lat                numeric(9, 6)              NOT NULL,
  pickup_lng                numeric(9, 6)              NOT NULL,
  destination_lat           numeric(9, 6)              NOT NULL,
  destination_lng           numeric(9, 6)              NOT NULL,
  parcel_description        text                                            ,
  parcel_weight_kg          numeric(6, 2)              NOT NULL CHECK (parcel_weight_kg > 0),
  parcel_length_mm          int                                             CHECK (parcel_length_mm IS NULL OR parcel_length_mm > 0),
  parcel_width_mm           int                                             CHECK (parcel_width_mm IS NULL OR parcel_width_mm > 0),
  parcel_height_mm          int                                             CHECK (parcel_height_mm IS NULL OR parcel_height_mm > 0),
  fragile                   boolean                    NOT NULL DEFAULT false,
  declared_value_idr        int                                             CHECK (declared_value_idr IS NULL OR declared_value_idr >= 0),
  prohibited_goods_declared boolean                    NOT NULL DEFAULT false,
  state                     nex.parcel_state           NOT NULL DEFAULT 'created',
  state_updated_at          timestamptz                NOT NULL DEFAULT now(),
  created_at                timestamptz                NOT NULL DEFAULT now(),
  completed_at              timestamptz                                     ,
  cancelled_at              timestamptz                                     ,
  cancel_reason             text                                            ,
  provenance                jsonb                      NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT completed_requires_completed_at
    CHECK (state <> 'completed' OR completed_at IS NOT NULL),
  CONSTRAINT lat_range CHECK (
    pickup_lat BETWEEN -90 AND 90 AND destination_lat BETWEEN -90 AND 90
  ),
  CONSTRAINT lng_range CHECK (
    pickup_lng BETWEEN -180 AND 180 AND destination_lng BETWEEN -180 AND 180
  )
);

CREATE INDEX IF NOT EXISTS idx_parcel_delivery_state
  ON nex.parcel_delivery (state, state_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_delivery_driver
  ON nex.parcel_delivery (driver_id, state_updated_at DESC) WHERE driver_id IS NOT NULL;

COMMENT ON TABLE nex.parcel_delivery IS
  'One row per parcel delivery. State machine enforced in application code (src/lib/nex-driver/parcel-lifecycle.ts). GPS observations may support evidence but NEVER promote state to completed.';
COMMENT ON COLUMN nex.parcel_delivery.state IS
  'Legal transitions in parcel-lifecycle.ts. completed requires recipient_confirmed as prior state.';

-- ── PARCEL EVENTS · chain of custody ledger ────────────────────────────

CREATE TABLE IF NOT EXISTS nex.parcel_event (
  event_id            uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id           uuid                       NOT NULL REFERENCES nex.parcel_delivery(parcel_id) ON DELETE CASCADE,
  kind                nex.parcel_event_kind      NOT NULL,
  occurred_at         timestamptz                NOT NULL DEFAULT now(),
  actor               text                                              ,-- 'sender' · 'driver' · 'recipient' · 'system'
  payload             jsonb                      NOT NULL DEFAULT '{}'::jsonb,
  storage_reference   text                                              ,-- photo / signature / OTP audit-log pointer
  observed_lat        numeric(9, 6)                                     ,
  observed_lng        numeric(9, 6)                                     ,
  provenance          jsonb                      NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_parcel_event_parcel
  ON nex.parcel_event (parcel_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_event_kind
  ON nex.parcel_event (kind, occurred_at DESC);

COMMENT ON TABLE nex.parcel_event IS
  'Chain-of-custody events. recipient_otp_verified / recipient_signature_captured / recipient_photo_captured are the events that permit transition to recipient_confirmed → completed. gps_observation is SUPPORTING evidence only.';

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   DROP TABLE IF EXISTS nex.parcel_event;
--   DROP TABLE IF EXISTS nex.parcel_delivery;
--   DROP TYPE  IF EXISTS nex.parcel_event_kind;
--   DROP TYPE  IF EXISTS nex.parcel_state;
-- COMMIT;
