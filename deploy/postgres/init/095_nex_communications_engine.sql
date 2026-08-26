-- deploy/postgres/init/095_nex_communications_engine.sql
--
-- NEX COMMUNICATIONS ENGINE · single outbound communications gateway
--
-- Doctrine anchors (2026-08-23):
--   - NO NEX SUBSYSTEM directly integrates with a WhatsApp / SMS / email
--     provider. Every outbound communication routes through this engine.
--   - PROVIDER INDEPENDENCE: providers are transport · NEX owns intelligence.
--   - GLOBAL SUPPRESSION cannot be overridden by any domain.
--   - PUBLIC-CONTACT-ONLY discipline preserved from transport-acquisition doctrine.
--   - CONSENT IS NEVER INFERRED from possession of a phone number.
--   - Kill switches default OFF · real outbound requires explicit env flags.
--   - Free-first channel routing: NEX-owned channels preferred where legitimately
--     available and permitted for the communication category.
--
-- Additive · unapplied · reversible.

BEGIN;

-- ── ENUMS ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nex.comms_channel AS ENUM (
    -- tier 0 · NEX-owned · free
    'nex_in_app',
    'nex_web',
    'nex_inbox',
    -- tier 1 · low-cost external
    'email',
    'push_notification',
    -- tier 2 · paid + regulated
    'whatsapp',
    -- tier 3 · paid
    'sms',
    'voice_call'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.comms_category AS ENUM (
    'transactional',
    'service',
    'support',
    'recruitment',
    'marketing',
    'verification',
    'security',
    'notification',
    'booking',
    'transport',
    'business_enquiry'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.comms_message_status AS ENUM (
    'queued',
    'submitted',
    'sent',
    'delivered',
    'read',
    'failed',
    'cancelled',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.comms_suppression_scope AS ENUM (
    'all',                    -- global stop · suppresses every category
    'marketing_only',
    'recruitment_only',
    'category_specific'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.comms_suppression_source AS ENUM (
    'recipient_stop_word',
    'recipient_direct_request',
    'admin_added',
    'legal_requirement',
    'bounce_or_invalid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.comms_permission_basis AS ENUM (
    'contract_performance',       -- active service relationship
    'transactional_response',     -- reply to something recipient initiated
    'explicit_opt_in',            -- recipient explicitly agreed
    'public_business_source',     -- publicly-advertised business contact (used ONLY for narrow business enquiry categories · never for marketing)
    'legal_obligation',
    'legitimate_interest_documented',
    'none'                        -- no basis · engine must refuse
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── CONTACT REGISTRY ───────────────────────────────────────────────────
-- Every recipient of a NEX communication is a comms_contact. The primary
-- dedupe key is canonical_phone_e164 (from nex-transport-acquisition/phone-normalisation).

CREATE TABLE IF NOT EXISTS nex.comms_contact (
  contact_id                   uuid                              PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_phone_e164         text                              UNIQUE,
  email                        text                              UNIQUE,
  in_app_user_ref              text                              UNIQUE,
  display_name                 text                                                 ,
  jurisdiction                 text                                                 ,
  contact_source               text                                                 ,-- e.g. 'nex-transport-acquisition' · 'user_registration'
  contact_source_reference     text                                                 ,-- specific source snapshot / user id
  first_seen_at                timestamptz                       NOT NULL DEFAULT now(),
  updated_at                   timestamptz                       NOT NULL DEFAULT now(),
  provenance                   jsonb                             NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT at_least_one_identity
    CHECK (canonical_phone_e164 IS NOT NULL OR email IS NOT NULL OR in_app_user_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_comms_contact_phone
  ON nex.comms_contact (canonical_phone_e164) WHERE canonical_phone_e164 IS NOT NULL;

COMMENT ON TABLE nex.comms_contact IS
  'One row per NEX communications recipient. Possession of a canonical_phone_e164 is NEVER consent · consent is evaluated separately via nex.comms_suppression + application-layer permission basis.';

-- ── SUPPRESSION LEDGER (global · cross-domain · immutable audit) ──────

CREATE TABLE IF NOT EXISTS nex.comms_suppression (
  suppression_id           uuid                              PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id               uuid                              NOT NULL REFERENCES nex.comms_contact(contact_id) ON DELETE CASCADE,
  scope                    nex.comms_suppression_scope       NOT NULL,
  category                 nex.comms_category                                    ,-- required when scope = 'category_specific'
  source                   nex.comms_suppression_source      NOT NULL,
  raw_signal               text                                                  ,-- the exact word/phrase captured (e.g. 'STOP' · 'TIDAK')
  created_at               timestamptz                       NOT NULL DEFAULT now(),
  effective_from           timestamptz                       NOT NULL DEFAULT now(),
  effective_to             timestamptz                                           ,-- null = permanent · admin may set an end date rarely
  audit_note               text                                                  ,
  CONSTRAINT category_scope_alignment
    CHECK (scope <> 'category_specific' OR category IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_comms_suppression_contact
  ON nex.comms_suppression (contact_id, scope) WHERE effective_to IS NULL;

COMMENT ON TABLE nex.comms_suppression IS
  'Immutable suppression ledger. Global · applies across all NEX domains. No domain code may bypass. Effective when effective_from <= now() and (effective_to IS NULL OR effective_to > now()).';

-- ── TEMPLATE REGISTRY ──────────────────────────────────────────────────
-- Templates are versioned · never silently altered · used templates are
-- retained forever so historical audits can reproduce the message content.

CREATE TABLE IF NOT EXISTS nex.comms_template (
  template_id                uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key               text                          NOT NULL,     -- stable name e.g. 'transport_recruitment_v1'
  version                    text                          NOT NULL,     -- e.g. '1' · '1.1' · '2'
  language                   text                          NOT NULL DEFAULT 'id',
  category                   nex.comms_category            NOT NULL,
  channel                    nex.comms_channel             NOT NULL,
  domain                     text                          NOT NULL,     -- e.g. 'driver_recruitment' · 'business_enquiry'
  content_ref                text                          NOT NULL,     -- reference to content storage (file path or CMS key)
  provider_template_ref      text                                        ,-- provider-registered template id where applicable
  status                     text                          NOT NULL DEFAULT 'draft'
                                                           CHECK (status IN ('draft', 'approved', 'retired')),
  approved_by                text                                        ,
  approved_at                timestamptz                                 ,
  retired_at                 timestamptz                                 ,
  notes                      text                                        ,
  UNIQUE (template_key, version, language, channel)
);

CREATE INDEX IF NOT EXISTS idx_comms_template_lookup
  ON nex.comms_template (template_key, language, status, channel);

-- ── CAMPAIGN ──────────────────────────────────────────────────────────
-- A campaign is a bounded outbound activity with budget + rate + suppression
-- rules that supplement the global rules.

CREATE TABLE IF NOT EXISTS nex.comms_campaign (
  campaign_id                uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key               text                          NOT NULL UNIQUE,
  domain                     text                          NOT NULL,
  category                   nex.comms_category            NOT NULL,
  jurisdiction               text                                        ,
  daily_budget_idr           int                                         CHECK (daily_budget_idr IS NULL OR daily_budget_idr >= 0),
  monthly_budget_idr         int                                         CHECK (monthly_budget_idr IS NULL OR monthly_budget_idr >= 0),
  max_cost_per_contact_idr   int                                         CHECK (max_cost_per_contact_idr IS NULL OR max_cost_per_contact_idr >= 0),
  daily_message_limit        int                                         CHECK (daily_message_limit IS NULL OR daily_message_limit >= 0),
  target_segment_note        text                                        ,
  status                     text                          NOT NULL DEFAULT 'draft'
                                                           CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  created_by                 text                          NOT NULL,
  approved_by                text                                        ,
  approved_at                timestamptz                                 ,
  created_at                 timestamptz                   NOT NULL DEFAULT now(),
  updated_at                 timestamptz                   NOT NULL DEFAULT now()
);

-- ── OUTBOUND MESSAGE AUDIT ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.comms_message (
  message_id                 uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key            text                          NOT NULL UNIQUE,
  contact_id                 uuid                          NOT NULL REFERENCES nex.comms_contact(contact_id),
  campaign_id                uuid                                        REFERENCES nex.comms_campaign(campaign_id),
  template_id                uuid                          NOT NULL REFERENCES nex.comms_template(template_id),
  channel                    nex.comms_channel             NOT NULL,
  category                   nex.comms_category            NOT NULL,
  domain                     text                          NOT NULL,
  domain_entity_ref          text                                        ,-- e.g. driver_candidate_id · booking_id
  correlation_id             text                                        ,
  permission_basis           nex.comms_permission_basis    NOT NULL,
  status                     nex.comms_message_status      NOT NULL DEFAULT 'queued',
  provider                   text                                        ,
  provider_message_id        text                                        ,
  cost_idr                   int                                         CHECK (cost_idr IS NULL OR cost_idr >= 0),
  currency                   text                          NOT NULL DEFAULT 'IDR',
  created_at                 timestamptz                   NOT NULL DEFAULT now(),
  sent_at                    timestamptz                                 ,
  delivered_at               timestamptz                                 ,
  read_at                    timestamptz                                 ,
  failed_at                  timestamptz                                 ,
  failure_reason             text                                        ,
  provenance                 jsonb                         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_comms_message_contact
  ON nex.comms_message (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_message_campaign
  ON nex.comms_message (campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comms_message_status
  ON nex.comms_message (status, created_at DESC);

COMMENT ON TABLE nex.comms_message IS
  'Every outbound message NEX intended to send. UNIQUE on idempotency_key prevents double-send under retry. cost_idr = actual provider cost recorded when known.';

-- ── MESSAGE EVENT LEDGER ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.comms_message_event (
  event_id             uuid                                PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id           uuid                                NOT NULL REFERENCES nex.comms_message(message_id) ON DELETE CASCADE,
  status               nex.comms_message_status            NOT NULL,
  occurred_at          timestamptz                         NOT NULL DEFAULT now(),
  provider_event_id    text                                                ,
  raw_payload          jsonb                               NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (message_id, status, provider_event_id)
);

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   DROP TABLE IF EXISTS nex.comms_message_event;
--   DROP TABLE IF EXISTS nex.comms_message;
--   DROP TABLE IF EXISTS nex.comms_campaign;
--   DROP TABLE IF EXISTS nex.comms_template;
--   DROP TABLE IF EXISTS nex.comms_suppression;
--   DROP TABLE IF EXISTS nex.comms_contact;
--   DROP TYPE  IF EXISTS nex.comms_permission_basis;
--   DROP TYPE  IF EXISTS nex.comms_suppression_source;
--   DROP TYPE  IF EXISTS nex.comms_suppression_scope;
--   DROP TYPE  IF EXISTS nex.comms_message_status;
--   DROP TYPE  IF EXISTS nex.comms_category;
--   DROP TYPE  IF EXISTS nex.comms_channel;
-- COMMIT;
