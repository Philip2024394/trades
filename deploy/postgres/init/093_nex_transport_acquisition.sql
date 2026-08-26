-- deploy/postgres/init/093_nex_transport_acquisition.sql
--
-- TRANSPORT DRIVER ACQUISITION UNIVERSE
--
-- Discovers publicly-advertised transport providers/drivers so NEX can later
-- invite them to register voluntarily. This is DISCOVERY only · a record here
-- is NEVER a verified driver, registered account, or dispatchable resource.
--
-- Doctrine anchors:
--   - Public-Contact-Only rule (2026-08-23 CONSTITUTIONAL): NEX may only
--     collect contact information when it is publicly advertised for
--     business/service contact. NEVER leaked · private · hacked · closed
--     groups · inferred · generated.
--   - Two Universes doctrine: Discovery ≠ Verified ≠ Dispatchable
--   - Truth Invariant (2026-08-22): every field cites its public source URL +
--     evidence that it was publicly advertised
--   - Legal Boundary First (2026-08-23): recruitment funnel cannot skip stages
--   - Reputation Non-Weapon: fraud detection uses REVIEW_REQUIRED flags · never
--     accusations
--   - Reuse Walker · not a second engine
--   - No second dashboard (subordinate under /nex-head-quarters only)
--
-- Additive · unapplied · reversible. NOT applied by this session.

BEGIN;

-- ── ENUMS ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nex.transport_vehicle_ontology AS ENUM (
    'motorcycle',
    'car',
    'taxi',
    'van',
    'mpv',
    'pickup',
    'small_truck',
    'truck',
    'lorry',
    'bus',
    'minibus',
    'courier',
    'airport_transfer',
    'tourist_driver',
    'logistics_operator',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.transport_provider_kind AS ENUM (
    'individual_driver',
    'driver_operator',
    'fleet_operator',
    'transport_business',
    'courier_operator',
    'logistics_operator',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.transport_recruitment_stage AS ENUM (
    'discovered',
    'public_contact_verified',
    'invitable',
    'invited',
    'interested',
    'registration_started',
    'registered',
    'kyc_pending',
    'vehicle_pending',
    'insurance_pending',
    'legal_review',
    'verified',
    'active',
    -- terminal / exit stages
    'declined',
    'unreachable',
    'opted_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allowed source-kinds ONLY. unknown_or_disallowed is used so a discovery run
-- can honestly refuse a record without inventing a false source-kind.
DO $$ BEGIN
  CREATE TYPE nex.transport_source_kind AS ENUM (
    'public_business_website',
    'public_maps_listing',
    'public_business_directory',
    'public_transport_service_listing',
    'public_driver_service_website',
    'public_facebook_business_page',
    'public_instagram_business_profile',
    'public_whatsapp_business_link',
    'public_marketplace_listing',
    'public_recruitment_advertisement',
    'other_public_business_source',
    'unknown_or_disallowed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.transport_review_flag AS ENUM (
    'duplicate_phone_across_unrelated',
    'impossible_vehicle_claims',
    'source_disappeared',
    'source_conflict',
    'generic_directory_number',
    'incompatible_vehicle_types',
    'copied_business_identity',
    'phone_used_by_unrelated_names',
    'invalid_phone_format',
    'source_evidence_insufficient'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.transport_contactability AS ENUM (
    'contactable',
    'unknown',
    'invalid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── MAIN ACQUISITION RECORD ────────────────────────────────────────────
-- One row per canonical provider. Deduplication key is canonical_phone_e164
-- when set · else (business_name, home_jurisdiction).

CREATE TABLE IF NOT EXISTS nex.transport_acquisition_record (
  provider_id                    uuid                                  PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_kind                  nex.transport_provider_kind           NOT NULL DEFAULT 'unknown',
  business_name                  text                                                      ,
  contact_person_name            text                                                      ,-- only if publicly advertised as business contact
  canonical_phone_e164           text                                  UNIQUE               ,-- +62... normalised
  public_whatsapp_link           text                                                      ,-- wa.me / api.whatsapp.com URL if publicly shared
  public_email                   text                                                      ,
  website                        text                                                      ,
  home_jurisdiction              text                                                      ,-- e.g. 'ID/DIY/Yogyakarta'
  city                           text                                                      ,
  province                       text                                                      ,
  service_areas                  text[]                                NOT NULL DEFAULT '{}'::text[],
  vehicle_types                  nex.transport_vehicle_ontology[]      NOT NULL DEFAULT '{}'::nex.transport_vehicle_ontology[],
  vehicle_models_public          jsonb                                 NOT NULL DEFAULT '[]'::jsonb, -- [{brand, model, variant, source_url}]
  supports_airport               boolean                               NOT NULL DEFAULT false,
  supports_parcel                boolean                               NOT NULL DEFAULT false,
  supports_passenger             boolean                               NOT NULL DEFAULT false,
  supports_tourist               boolean                               NOT NULL DEFAULT false,
  supports_logistics             boolean                               NOT NULL DEFAULT false,
  public_registration_info       text                                                      ,-- e.g. company reg no. IF publicly stated
  discovery_stage                nex.transport_recruitment_stage       NOT NULL DEFAULT 'discovered',
  contactability                 nex.transport_contactability          NOT NULL DEFAULT 'unknown',
  review_flags                   nex.transport_review_flag[]           NOT NULL DEFAULT '{}'::nex.transport_review_flag[],
  first_discovered_at            timestamptz                           NOT NULL DEFAULT now(),
  last_seen_at                   timestamptz                           NOT NULL DEFAULT now(),
  cycle_run_id                   uuid                                                      ,-- FK-style to worker_cycle_run
  provenance                     jsonb                                 NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT dedupe_needs_key
    CHECK (canonical_phone_e164 IS NOT NULL OR business_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_transport_acq_stage
  ON nex.transport_acquisition_record (discovery_stage);
CREATE INDEX IF NOT EXISTS idx_transport_acq_jurisdiction
  ON nex.transport_acquisition_record (home_jurisdiction, discovery_stage);
CREATE INDEX IF NOT EXISTS idx_transport_acq_review
  ON nex.transport_acquisition_record USING GIN (review_flags)
  WHERE array_length(review_flags, 1) IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_acq_vehicle_types
  ON nex.transport_acquisition_record USING GIN (vehicle_types);

COMMENT ON TABLE nex.transport_acquisition_record IS
  'Publicly-advertised transport providers discovered by the Transport Walker. DISCOVERY only · never a verified driver. Deduplication key: canonical_phone_e164. All fields must trace to a public-source snapshot.';
COMMENT ON COLUMN nex.transport_acquisition_record.canonical_phone_e164 IS
  'E.164 normalised phone. Public phone/WhatsApp collapses here so 0812x = +62812x = 62812x resolve to one provider.';
COMMENT ON COLUMN nex.transport_acquisition_record.discovery_stage IS
  'Recruitment funnel stage. NEVER skip stages. discovered → public_contact_verified → invitable → invited → interested → registration_started → registered → kyc_pending → vehicle_pending → insurance_pending → legal_review → verified → active. Terminals: declined · unreachable · opted_out.';

-- ── SOURCE SNAPSHOTS ───────────────────────────────────────────────────
-- Every claim about a provider must trace to a public source snapshot. One row
-- per (provider, source_url, captured_at).

CREATE TABLE IF NOT EXISTS nex.transport_acquisition_source_snapshot (
  snapshot_id                    uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                    uuid                          NOT NULL REFERENCES nex.transport_acquisition_record(provider_id) ON DELETE CASCADE,
  source_url                     text                          NOT NULL,
  source_kind                    nex.transport_source_kind     NOT NULL,
  source_captured_at             timestamptz                   NOT NULL DEFAULT now(),
  source_licence_terms           text                                          ,
  raw_payload                    jsonb                         NOT NULL DEFAULT '{}'::jsonb,
  public_evidence_note           text                                          ,-- one-line human note: why NEX believes this was publicly advertised
  ingested_by                    text                                          ,
  cycle_run_id                   uuid                                          ,
  CONSTRAINT source_kind_must_be_public CHECK (source_kind <> 'unknown_or_disallowed')
);

CREATE INDEX IF NOT EXISTS idx_transport_acq_snapshot_provider
  ON nex.transport_acquisition_source_snapshot (provider_id, source_captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_transport_acq_snapshot_url
  ON nex.transport_acquisition_source_snapshot (source_url);

COMMENT ON TABLE nex.transport_acquisition_source_snapshot IS
  'Public-source snapshot per provider. CHECK constraint refuses to persist unknown_or_disallowed sources. Every field on transport_acquisition_record must trace back to at least one snapshot here.';

-- ── OUTREACH LEDGER (design-only · no automatic sender) ────────────────
-- Records outreach ATTEMPTS with a required public-source-evidence reference
-- for every message NEX would send to a discovered contact. Respect opt-outs.

CREATE TABLE IF NOT EXISTS nex.transport_acquisition_outreach (
  outreach_id                    uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                    uuid                          NOT NULL REFERENCES nex.transport_acquisition_record(provider_id) ON DELETE CASCADE,
  recipient_channel              text                          NOT NULL CHECK (recipient_channel IN ('whatsapp', 'email', 'sms', 'call')),
  recipient_reference            text                          NOT NULL,        -- the public contact used
  source_evidence_snapshot_id    uuid                          NOT NULL REFERENCES nex.transport_acquisition_source_snapshot(snapshot_id),
  message_version                text                          NOT NULL,
  sent_at                        timestamptz                                   ,
  response                       text                                          ,
  response_at                    timestamptz                                   ,
  opted_out_at                   timestamptz                                   ,
  handled_by                     text                                          ,
  status                         text                          NOT NULL DEFAULT 'draft'
                                                               CHECK (status IN ('draft', 'ready_to_send', 'sent', 'delivered', 'responded', 'opted_out', 'refused'))
);

CREATE INDEX IF NOT EXISTS idx_transport_acq_outreach_provider
  ON nex.transport_acquisition_outreach (provider_id, sent_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_transport_acq_outreach_optout
  ON nex.transport_acquisition_outreach (provider_id) WHERE opted_out_at IS NOT NULL;

COMMENT ON TABLE nex.transport_acquisition_outreach IS
  'Outreach ledger. Each outreach REQUIRES a source_evidence_snapshot_id proving the recipient contact was publicly advertised. No automatic sender in this migration · a separate approved unit would activate sending.';

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   DROP TABLE IF EXISTS nex.transport_acquisition_outreach;
--   DROP TABLE IF EXISTS nex.transport_acquisition_source_snapshot;
--   DROP TABLE IF EXISTS nex.transport_acquisition_record;
--   DROP TYPE  IF EXISTS nex.transport_contactability;
--   DROP TYPE  IF EXISTS nex.transport_review_flag;
--   DROP TYPE  IF EXISTS nex.transport_source_kind;
--   DROP TYPE  IF EXISTS nex.transport_recruitment_stage;
--   DROP TYPE  IF EXISTS nex.transport_provider_kind;
--   DROP TYPE  IF EXISTS nex.transport_vehicle_ontology;
-- COMMIT;
