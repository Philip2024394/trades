-- deploy/postgres/init/091_nex_transport_legal_model_and_pdp.sql
--
-- LEGAL BOUNDARY + PDP COMPLIANCE + AUTHORITY REQUEST + TERMS ACCEPTANCE
--
-- Doctrine anchors (2026-08-23):
--   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): NEX must not simply copy
--     the Grab/Gojek model and rebrand it. Before ANY driver dispatch activation,
--     a jurisdiction-specific legal operating model must be researched, documented,
--     approved, and recorded here.
--   - PDP compliance (2026-08-23): driver location processing must have a stated
--     purpose, a lawful basis, a retention period, a notice version acknowledged,
--     and audit trail — never secret or indefinite surveillance.
--   - Reputation Non-Weapon (2026-08-23): every trip must be reconstructable from
--     evidence for authority requests without exposing beyond scope.
--   - Truth Invariant (2026-08-22): T&Cs cannot override statutory allocation of
--     liability. Records must reflect what NEX actually did.
--
-- Additive · unapplied · reversible. NOT applied by this session.

BEGIN;

-- ── ENUMS ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nex.transport_legal_model_status AS ENUM (
    'researching',        -- initial · analysis under way
    'pending_approval',   -- research complete · awaiting internal legal sign-off
    'approved',           -- signed off · Stage-B may be considered
    'suspended',          -- previously approved · put on hold (regulator change · dispute)
    'rejected'            -- research concluded NEX cannot operate under this model
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.nex_transport_role AS ENUM (
    'undetermined',       -- default until legal analysis complete
    'technology_provider',
    'intermediary',
    'marketplace',
    'booking_platform',
    'transport_operator', -- if this is chosen, additional obligations apply
    'other_regulated_role'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.booking_arrangement_kind AS ENUM (
    'dispatch_authorised',  -- traveller requests NEX to find + dispatch a driver (Stage-B only)
    'direct_contact',       -- traveller contacts a driver directly through NEX's directory
    'self_arranged'         -- traveller already has a driver; NEX assists with logistics only
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.consent_purpose AS ENUM (
    'trip_verification',
    'safety',
    'dispute_resolution',
    'fraud_prevention',
    'journey_recording',
    'lawful_authority_request'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.consent_lawful_basis AS ENUM (
    'explicit_consent',
    'contract_performance',
    'legal_obligation',
    'legitimate_interest_documented'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.authority_kind AS ENUM (
    'kemenhub',
    'dishub',
    'police',
    'court',
    'data_protection_authority',
    'tax_authority',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.authority_request_status AS ENUM (
    'received',
    'authenticating',
    'authenticated',
    'refused_unauthenticated',
    'refused_out_of_scope',
    'responded',
    'appealed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.terms_kind AS ENUM (
    'passenger_terms',
    'driver_terms',
    'privacy_notice'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TRANSPORT LEGAL MODEL REGISTRY ─────────────────────────────────────
-- One row per (jurisdiction · effective_from). Stage-B activation requires
-- an APPROVED row whose effective window covers the request time. Absence
-- of an approved row → dispatch REFUSES.

CREATE TABLE IF NOT EXISTS nex.transport_legal_model (
  legal_model_id            uuid                             PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction              text                             NOT NULL,       -- e.g. 'ID/DIY/Yogyakarta'
  effective_from            timestamptz                      NOT NULL,
  effective_to              timestamptz                                     ,
  nex_role                  nex.nex_transport_role           NOT NULL DEFAULT 'undetermined',
  driver_role               text                                            ,-- summary of the driver's independent legal role
  operator_licence_ref      text                                            ,-- reference to the operator licence holder (if any)
  insurance_requirements    jsonb                            NOT NULL DEFAULT '{}'::jsonb,
  applicable_regulations    text[]                           NOT NULL DEFAULT '{}'::text[],  -- e.g. {'PM 118/2018', 'PM 17/2019', 'PM 1/2026'}
  document_reference        text                                            ,-- pointer to the legal analysis document
  status                    nex.transport_legal_model_status NOT NULL DEFAULT 'researching',
  approved_by               text                                            ,-- signed-off by (name/role)
  approved_at               timestamptz                                     ,
  notes                     text                                            ,
  created_at                timestamptz                      NOT NULL DEFAULT now(),
  updated_at                timestamptz                      NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_legal_model_jurisdiction_status
  ON nex.transport_legal_model (jurisdiction, status, effective_from DESC);

COMMENT ON TABLE nex.transport_legal_model IS
  'Stage-B dispatch REFUSES unless an approved row exists whose effective window covers the request time. No approved row = no dispatch. Doctrine: legal structure drives product · never the other way around.';

-- Seed an initial researching row for Yogyakarta so operators can see the
-- research is under way. status = 'researching' does NOT permit dispatch.
INSERT INTO nex.transport_legal_model (
  jurisdiction, effective_from, nex_role, driver_role,
  applicable_regulations, status, notes
) VALUES (
  'ID/DIY/Yogyakarta',
  now(),
  'undetermined',
  'unresearched · driver legal obligations under Indonesian transport regulations pending analysis',
  ARRAY['PM 118/2018', 'PM 17/2019', 'PM 1/2026 (successor to PM 12/2021 / PM 13/2023)'],
  'researching',
  'Initial placeholder. Full analysis required covering: Kemenhub instruments (PM 118/2018 as amended by PM 17/2019, PM 1/2026 risk-based transport business/activity standard), applicable DIY regulations, Angkutan Sewa Khusus requirements, driver/operator/insurance obligations, platform/intermediary responsibility, PDP compliance. Stage-B remains locked.'
) ON CONFLICT DO NOTHING;

-- ── PDP-COMPLIANT CONSENT EXTENSION ────────────────────────────────────
-- Extends driver_location_consent (created by migration 090) with fields
-- required by Indonesia's PDP law: stated purposes, lawful basis, retention,
-- notice version acknowledged.

ALTER TABLE nex.driver_location_consent
  ADD COLUMN IF NOT EXISTS purposes                 nex.consent_purpose[]       NOT NULL DEFAULT '{}'::nex.consent_purpose[],
  ADD COLUMN IF NOT EXISTS lawful_basis             nex.consent_lawful_basis    ,
  ADD COLUMN IF NOT EXISTS retention_days           int                         ,
  ADD COLUMN IF NOT EXISTS notice_version_acknowledged text                     ,
  ADD COLUMN IF NOT EXISTS retention_policy_ref     text                        ;

COMMENT ON COLUMN nex.driver_location_consent.purposes IS
  'Stated purposes for which location may be processed. NEX may not process location for purposes outside this array. PDP compliance.';
COMMENT ON COLUMN nex.driver_location_consent.lawful_basis IS
  'Lawful basis under Indonesian PDP law. When basis = explicit_consent, consent must be explicit, recorded, understandable and purpose-specific.';

-- ── AUTHORITY REQUEST PATHWAY ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.authority_request (
  authority_request_id      uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at               timestamptz                NOT NULL DEFAULT now(),
  authority_kind            nex.authority_kind         NOT NULL,
  authority_reference       text                       NOT NULL,       -- e.g. case number · warrant ref
  legal_basis_cited         text                       NOT NULL,
  scope_description         text                       NOT NULL,       -- date range · specific trip_ids · specific driver_ids
  scope_json                jsonb                      NOT NULL DEFAULT '{}'::jsonb,
  authentication_evidence   text                                       ,-- how NEX verified the request is genuine
  status                    nex.authority_request_status NOT NULL DEFAULT 'received',
  handled_at                timestamptz                                ,
  handled_by                text                                       ,
  response_document_ref     text                                       ,-- pointer to response bundle
  refused_reason            text                                       ,
  notes                     text                                       ,
  CONSTRAINT refused_needs_reason CHECK (
    status NOT IN ('refused_unauthenticated', 'refused_out_of_scope')
    OR refused_reason IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_authority_request_received
  ON nex.authority_request (received_at DESC);

-- ── TERMS ACCEPTANCE LEDGER ────────────────────────────────────────────
-- Every user acceptance of passenger/driver/privacy terms is a row.
-- Never rewrite · new acceptance = new row. Legacy remains for audit.

CREATE TABLE IF NOT EXISTS nex.terms_acceptance (
  acceptance_id             uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind              text                       NOT NULL CHECK (subject_kind IN ('passenger', 'driver')),
  subject_id                text                       NOT NULL,        -- opaque · e.g. driver_id or passenger session ref
  terms_kind                nex.terms_kind             NOT NULL,
  terms_version             text                       NOT NULL,
  accepted_at               timestamptz                NOT NULL DEFAULT now(),
  ip_reference              text                                       ,-- hashed / bucketed to comply with PDP minimisation
  device_reference          text                                       ,
  method                    text                       NOT NULL DEFAULT 'in_app_button',
  UNIQUE (subject_kind, subject_id, terms_kind, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptance_subject
  ON nex.terms_acceptance (subject_kind, subject_id, terms_kind, accepted_at DESC);

-- ── BOOKING ARRANGEMENT ON TRIP REQUEST ────────────────────────────────
-- Every trip request must declare its arrangement kind. dispatch_authorised
-- requires Stage-B activation AND an approved legal model. direct_contact
-- and self_arranged are lower-risk arrangements NEX may facilitate earlier.

ALTER TABLE nex.trip_request
  ADD COLUMN IF NOT EXISTS arrangement_kind nex.booking_arrangement_kind;

COMMENT ON COLUMN nex.trip_request.arrangement_kind IS
  'Legally distinguishes what NEX actually did in this transaction. dispatch_authorised = NEX matched + dispatched (Stage-B). direct_contact = NEX put traveller in touch with a directory driver. self_arranged = NEX only helped with logistics; traveller and driver arranged themselves.';

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   ALTER TABLE nex.trip_request DROP COLUMN IF EXISTS arrangement_kind;
--   DROP TABLE IF EXISTS nex.terms_acceptance;
--   DROP TABLE IF EXISTS nex.authority_request;
--   ALTER TABLE nex.driver_location_consent
--     DROP COLUMN IF EXISTS retention_policy_ref,
--     DROP COLUMN IF EXISTS notice_version_acknowledged,
--     DROP COLUMN IF EXISTS retention_days,
--     DROP COLUMN IF EXISTS lawful_basis,
--     DROP COLUMN IF EXISTS purposes;
--   DROP TABLE IF EXISTS nex.transport_legal_model;
--   DROP TYPE  IF EXISTS nex.terms_kind;
--   DROP TYPE  IF EXISTS nex.authority_request_status;
--   DROP TYPE  IF EXISTS nex.authority_kind;
--   DROP TYPE  IF EXISTS nex.consent_lawful_basis;
--   DROP TYPE  IF EXISTS nex.consent_purpose;
--   DROP TYPE  IF EXISTS nex.booking_arrangement_kind;
--   DROP TYPE  IF EXISTS nex.nex_transport_role;
--   DROP TYPE  IF EXISTS nex.transport_legal_model_status;
-- COMMIT;
