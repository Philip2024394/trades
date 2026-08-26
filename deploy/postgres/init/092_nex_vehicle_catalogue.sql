-- deploy/postgres/init/092_nex_vehicle_catalogue.sql
--
-- VEHICLE CATALOGUE + DRIVER-VEHICLE VERIFICATION
--
-- Doctrine anchors:
--   - Vehicle catalogue (2026-08-23): driver declares vehicle at registration ·
--     NEX maps to catalogue entry · vehicle-evidence verified before the
--     catalogue entry may be presented in a booking card. Premium classes
--     require the class-confirming document evidence.
--   - Legal Boundary First (2026-08-23): vehicle info shown to customers must
--     reflect verified reality · never a class NEX cannot attest to.
--   - Truth Invariant (2026-08-22): every catalogue entry shown to a customer
--     traces to a verification record.
--
-- Additive · unapplied · reversible.

BEGIN;

DO $$ BEGIN
  CREATE TYPE nex.vehicle_class AS ENUM (
    'scooter',
    'motorbike_standard',
    'motorbike_premium',
    'car_small',
    'car_mpv',
    'car_premium_mpv',
    'car_premium',
    'van',
    'minibus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.driver_vehicle_verification_state AS ENUM (
    'unverified',
    'documents_submitted',
    'verified',
    'rejected',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.vehicle_kind AS ENUM (
    'motorcycle',
    'car',
    'pickup',
    'small_truck',
    'truck',
    'van',
    'minibus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── VEHICLE MANUFACTURER ──────────────────────────────────────────────
-- Canonical manufacturer table. Manufacturer names may appear in more than
-- one vehicle kind (Honda makes bikes AND cars) · this table stores the
-- manufacturer identity independently of what they build.

CREATE TABLE IF NOT EXISTS nex.vehicle_manufacturer (
  manufacturer_id   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text          NOT NULL UNIQUE,
  home_country      text                          ,
  discontinued_at   timestamptz                   ,
  notes             text                          ,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- ── VEHICLE CATALOGUE ─────────────────────────────────────────────────
-- One row per (brand, model, variant, class). image_ref may be null until
-- artwork is available. New fields (manufacturer_id · variant · vehicle_kind ·
-- display_name · passenger/luggage capacity) are additive and nullable so
-- existing rows and existing test fixtures remain compatible.

CREATE TABLE IF NOT EXISTS nex.vehicle_catalogue_entry (
  catalogue_id           uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  brand                  text                NOT NULL,                          -- kept denormalised for existing readers
  model                  text                NOT NULL,
  vehicle_class          nex.vehicle_class   NOT NULL,
  image_ref              text                                    ,              -- ImageKit / storage pointer · null until artwork added
  introduced_at          timestamptz         NOT NULL DEFAULT now(),
  deprecated_at          timestamptz                             ,              -- non-null = catalogue removes this from selection
  notes                  text                                    ,

  -- New hierarchy + capacity fields (all nullable for backwards compat)
  manufacturer_id        uuid                REFERENCES nex.vehicle_manufacturer(manufacturer_id) ON DELETE SET NULL,
  variant                text                                    ,              -- e.g. 'ABS' · '2024' · 'Q Cross'
  vehicle_kind           nex.vehicle_kind                        ,              -- motorcycle · car · pickup · small_truck · truck · van · minibus
  display_name           text                                    ,              -- e.g. 'Honda PCX 160 ABS' · null → derive from brand+model+variant
  passenger_capacity     int                 CHECK (passenger_capacity IS NULL OR passenger_capacity > 0),
  luggage_capacity_kg    int                 CHECK (luggage_capacity_kg IS NULL OR luggage_capacity_kg > 0),
  luggage_dimensions_mm  jsonb                                   ,              -- e.g. {"length":1000,"width":1000,"height":800}

  UNIQUE (brand, model, variant, vehicle_class)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_catalogue_class
  ON nex.vehicle_catalogue_entry (vehicle_class) WHERE deprecated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_catalogue_manufacturer
  ON nex.vehicle_catalogue_entry (manufacturer_id) WHERE deprecated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_catalogue_kind
  ON nex.vehicle_catalogue_entry (vehicle_kind) WHERE deprecated_at IS NULL;

COMMENT ON TABLE nex.vehicle_catalogue_entry IS
  'Data-driven vehicle catalogue. Driver selects manufacturer → model → variant. Customer-facing representation reads from here + driver_vehicle_verification. Catalogue image is an ILLUSTRATION · never presented as a photograph of the specific driver''s vehicle.';
COMMENT ON COLUMN nex.vehicle_catalogue_entry.image_ref IS
  'Reference to a catalogue illustration. NEVER a photo of a specific driver''s vehicle · driver photos live in nex.driver_vehicle_verification.photo_document_ref.';

-- ── SEED · MANUFACTURERS ──────────────────────────────────────────────

INSERT INTO nex.vehicle_manufacturer (name, home_country, notes) VALUES
  ('Honda',      'JP', NULL),
  ('Yamaha',     'JP', NULL),
  ('Suzuki',     'JP', NULL),
  ('Kawasaki',   'JP', NULL),
  ('Toyota',     'JP', NULL),
  ('Daihatsu',   'JP', NULL),
  ('Mitsubishi', 'JP', NULL),
  ('Hyundai',    'KR', NULL),
  ('Isuzu',      'JP', NULL)
ON CONFLICT (name) DO NOTHING;

-- ── SEED · CANONICAL INDONESIAN-RELEVANT VEHICLES ────────────────────
-- Curated initial set. Additional entries add later without schema change.
-- Vehicle-class assignments are conservative · premium classes require
-- verification.class_confirmed = true before customer-facing display.

WITH mfr AS (
  SELECT name, manufacturer_id FROM nex.vehicle_manufacturer
)
INSERT INTO nex.vehicle_catalogue_entry
  (brand, model, variant, vehicle_class, vehicle_kind, manufacturer_id, display_name, passenger_capacity, luggage_capacity_kg)
SELECT * FROM (VALUES
  -- Motorcycles
  ('Honda',      'PCX 160',   NULL, 'motorbike_premium',  'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Honda'),      'Honda PCX 160',      1, 20),
  ('Honda',      'Vario 160', NULL, 'motorbike_standard', 'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Honda'),      'Honda Vario 160',    1, 15),
  ('Honda',      'Scoopy',    NULL, 'scooter',            'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Honda'),      'Honda Scoopy',       1, 10),
  ('Honda',      'BeAT',      NULL, 'scooter',            'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Honda'),      'Honda BeAT',         1, 10),
  ('Yamaha',     'NMAX',      NULL, 'motorbike_premium',  'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Yamaha'),     'Yamaha NMAX',        1, 20),
  ('Yamaha',     'Aerox',     NULL, 'motorbike_standard', 'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Yamaha'),     'Yamaha Aerox',       1, 15),
  ('Yamaha',     'Mio',       NULL, 'scooter',            'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Yamaha'),     'Yamaha Mio',         1, 10),
  ('Suzuki',     'Address',   NULL, 'scooter',            'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Suzuki'),     'Suzuki Address',     1, 10),
  ('Kawasaki',   'KLX 150',   NULL, 'motorbike_standard', 'motorcycle', (SELECT manufacturer_id FROM mfr WHERE name='Kawasaki'),   'Kawasaki KLX 150',   1, 10),
  -- Cars
  ('Toyota',     'Avanza',    NULL, 'car_mpv',            'car',        (SELECT manufacturer_id FROM mfr WHERE name='Toyota'),     'Toyota Avanza',      7, 100),
  ('Toyota',     'Innova',    NULL, 'car_mpv',            'car',        (SELECT manufacturer_id FROM mfr WHERE name='Toyota'),     'Toyota Innova',      7, 150),
  ('Toyota',     'Alphard',   NULL, 'car_premium_mpv',    'car',        (SELECT manufacturer_id FROM mfr WHERE name='Toyota'),     'Toyota Alphard',     7, 200),
  ('Toyota',     'Fortuner',  NULL, 'car_premium',        'car',        (SELECT manufacturer_id FROM mfr WHERE name='Toyota'),     'Toyota Fortuner',    7, 200),
  ('Toyota',     'Agya',      NULL, 'car_small',          'car',        (SELECT manufacturer_id FROM mfr WHERE name='Toyota'),     'Toyota Agya',        5,  40),
  ('Daihatsu',   'Xenia',     NULL, 'car_mpv',            'car',        (SELECT manufacturer_id FROM mfr WHERE name='Daihatsu'),   'Daihatsu Xenia',     7, 100),
  ('Daihatsu',   'Terios',    NULL, 'car_mpv',            'car',        (SELECT manufacturer_id FROM mfr WHERE name='Daihatsu'),   'Daihatsu Terios',    7, 100),
  ('Mitsubishi', 'Xpander',   NULL, 'car_mpv',            'car',        (SELECT manufacturer_id FROM mfr WHERE name='Mitsubishi'), 'Mitsubishi Xpander', 7, 130),
  ('Mitsubishi', 'Pajero Sport', NULL, 'car_premium',     'car',        (SELECT manufacturer_id FROM mfr WHERE name='Mitsubishi'), 'Mitsubishi Pajero Sport', 7, 200),
  ('Hyundai',    'Stargazer', NULL, 'car_mpv',            'car',        (SELECT manufacturer_id FROM mfr WHERE name='Hyundai'),    'Hyundai Stargazer',  7, 130),
  -- Larger goods
  ('Daihatsu',   'Gran Max Pick Up', NULL, 'minibus',     'pickup',     (SELECT manufacturer_id FROM mfr WHERE name='Daihatsu'),   'Daihatsu Gran Max Pick Up', 2, 1000),
  ('Suzuki',     'Carry Pick Up',    NULL, 'minibus',     'pickup',     (SELECT manufacturer_id FROM mfr WHERE name='Suzuki'),     'Suzuki Carry Pick Up',      2,  800),
  ('Isuzu',      'Elf',              NULL, 'minibus',     'small_truck',(SELECT manufacturer_id FROM mfr WHERE name='Isuzu'),      'Isuzu Elf',                 3, 2500),
  ('Mitsubishi', 'Colt Diesel',      NULL, 'minibus',     'small_truck',(SELECT manufacturer_id FROM mfr WHERE name='Mitsubishi'), 'Mitsubishi Colt Diesel',    3, 3000)
) AS v(brand, model, variant, vehicle_class, vehicle_kind, manufacturer_id, display_name, passenger_capacity, luggage_capacity_kg)
ON CONFLICT (brand, model, variant, vehicle_class) DO NOTHING;

-- ── DRIVER DECLARES VEHICLE ────────────────────────────────────────────
-- Additive column on driver: declared_vehicle_catalogue_id. Not sufficient
-- alone to show the vehicle to a customer — verification below is also required.

ALTER TABLE nex.driver
  ADD COLUMN IF NOT EXISTS declared_vehicle_catalogue_id uuid REFERENCES nex.vehicle_catalogue_entry(catalogue_id);

-- ── VEHICLE VERIFICATION ───────────────────────────────────────────────
-- One row per (driver, catalogue_entry). Records the state + attributable
-- verifier + document pointer + class_confirmed flag. Premium classes require
-- class_confirmed = true.

CREATE TABLE IF NOT EXISTS nex.driver_vehicle_verification (
  verification_id           uuid                                    PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                 uuid                                    NOT NULL REFERENCES nex.driver(driver_id) ON DELETE CASCADE,
  catalogue_id              uuid                                    NOT NULL REFERENCES nex.vehicle_catalogue_entry(catalogue_id),
  state                     nex.driver_vehicle_verification_state   NOT NULL DEFAULT 'unverified',
  registration_document_ref text                                                       ,-- vehicle-registration doc pointer
  photo_document_ref        text                                                       ,-- driver-provided photo of vehicle
  submitted_at              timestamptz                                                ,
  verified_at               timestamptz                                                ,
  verified_by               text                                                       ,-- admin/agent identifier
  class_confirmed           boolean                                 NOT NULL DEFAULT false,
  rejected_at               timestamptz                                                ,
  rejection_reason          text                                                       ,
  expires_at                timestamptz                                                ,
  UNIQUE (driver_id, catalogue_id),
  CONSTRAINT verified_needs_attribution
    CHECK (state <> 'verified' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)),
  CONSTRAINT rejected_needs_reason
    CHECK (state <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_verification_state
  ON nex.driver_vehicle_verification (driver_id, state);

COMMENT ON TABLE nex.driver_vehicle_verification IS
  'Verification record binding driver → catalogue entry. Customer-facing vehicle representation requires state=verified AND (if premium class) class_confirmed=true.';

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   DROP TABLE IF EXISTS nex.driver_vehicle_verification;
--   ALTER TABLE nex.driver DROP COLUMN IF EXISTS declared_vehicle_catalogue_id;
--   DROP TABLE IF EXISTS nex.vehicle_catalogue_entry;
--   DROP TABLE IF EXISTS nex.vehicle_manufacturer;
--   DROP TYPE  IF EXISTS nex.vehicle_kind;
--   DROP TYPE  IF EXISTS nex.driver_vehicle_verification_state;
--   DROP TYPE  IF EXISTS nex.vehicle_class;
-- COMMIT;
