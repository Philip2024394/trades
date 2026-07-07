-- XRatedTrade OS — Consent Architecture (Phase 1.5, gap 1/4).
--
-- GDPR right-to-erasure vs graph-moat retention is the largest legal
-- risk in the entire architecture. Retroactive consent is not valid
-- consent under UK/EU law, so this primitive MUST exist at Day 0.
-- Every purpose we might monetise later (manufacturer data seats,
-- insurer risk feeds, lender valuation intelligence) requires a
-- specific consent grant traceable back to the moment the data was
-- captured.
--
-- Four objects:
--   os_consent_purposes         — canonical purpose registry
--   os_consent_grants           — party × purpose × version × grant/revoke state
--   os_data_exports             — which buyer has access to which slice
--   os_data_erasure_requests    — structured erasure workflow with
--                                 anonymisation-vs-delete resolution
--
-- Design principle: consent is versioned. When we change the wording
-- of a purpose (e.g., add a data category), a new purpose_version is
-- created; existing grants are preserved but marked against the old
-- version, and users may be prompted to re-consent for the new one.
-- We never mutate a granted consent record.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Consent purposes — canonical registry of what we ask consent for
--
-- Each row is a stable purpose identifier (e.g., 'ecosystem_display',
-- 'manufacturer_data_seat', 'insurer_risk_feed') paired with a
-- versioned human-readable description. New versions supersede old
-- but old versions are preserved for audit.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_consent_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_key text NOT NULL,                -- 'ecosystem_display', 'analytics', ...
  version integer NOT NULL,                 -- monotonically increasing per key
  headline text NOT NULL,                   -- shown in consent dialog
  description text NOT NULL,                -- full explanation
  data_categories text[] NOT NULL DEFAULT '{}',
    -- what personal data types this covers ("identity", "contact",
    -- "location", "behavioural", "content")
  legal_basis text NOT NULL
    CHECK (legal_basis IN (
      'consent',                            -- GDPR Article 6(1)(a)
      'contract',                           -- 6(1)(b)
      'legal_obligation',                   -- 6(1)(c)
      'vital_interests',                    -- 6(1)(d)
      'public_task',                        -- 6(1)(e)
      'legitimate_interests'                -- 6(1)(f)
    )),
  retention_days integer,                   -- null = indefinite (rare)
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_consent_purposes_key_version_uk UNIQUE (purpose_key, version)
);

CREATE INDEX IF NOT EXISTS os_consent_purposes_key_idx
  ON os_consent_purposes (purpose_key) WHERE active = true;

-- ---------------------------------------------------------------------
-- 2. Consent grants — the actual grant / revoke ledger
--
-- Append-only. Every grant, revoke, re-grant is a new row. Current
-- state for (party, purpose) is derived by picking the most recent
-- row. Never UPDATE a grant — always INSERT a new state row.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,
    -- ON DELETE RESTRICT — party can't be hard-deleted while grants
    -- exist. Erasure goes through os_data_erasure_requests instead.
  purpose_key text NOT NULL,
  purpose_version integer NOT NULL,
  state text NOT NULL
    CHECK (state IN ('granted','revoked','superseded_by_new_version')),
  granularity jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- fine-grained toggles within a purpose, e.g. {"email":true,"phone":false}
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_surface text,                    -- "signup", "settings", "dialog_v2"
  captured_ip_hash text,                    -- hashed IP for evidence
  captured_user_agent text,
  evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
  notes text,

  CONSTRAINT os_consent_grants_purpose_ref
    FOREIGN KEY (purpose_key, purpose_version)
    REFERENCES os_consent_purposes (purpose_key, version)
);

CREATE INDEX IF NOT EXISTS os_consent_grants_party_purpose_idx
  ON os_consent_grants (party_id, purpose_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS os_consent_grants_state_idx
  ON os_consent_grants (state, captured_at DESC);
CREATE INDEX IF NOT EXISTS os_consent_grants_purpose_captured_idx
  ON os_consent_grants (purpose_key, captured_at DESC);

-- ---------------------------------------------------------------------
-- 3. Data exports — which buyer received which slice
--
-- Every enterprise data delivery (manufacturer seat, insurer feed,
-- research partner, subpoena response) writes a row. Includes the
-- consent basis used, the parties whose data was included, and the
-- exact query / slice served. Audit primitive for regulator response.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,                 -- "Wren Kitchens", "Aviva Home"
  buyer_contract_ref text,                  -- our internal contract id
  purpose_key text NOT NULL,
  purpose_version integer NOT NULL,
  slice_definition jsonb NOT NULL,          -- structured description of what
                                            -- was exported (filters, fields,
                                            -- row count, timeframe)
  party_ids uuid[] NOT NULL DEFAULT '{}',   -- parties whose data was included
  business_ids uuid[] NOT NULL DEFAULT '{}',
  row_count integer NOT NULL DEFAULT 0,
  export_format text,                       -- "csv", "parquet", "api_stream"
  delivered_at timestamptz NOT NULL DEFAULT now(),
  delivered_by uuid,                        -- staff party id
  delivery_evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_data_exports_purpose_ref
    FOREIGN KEY (purpose_key, purpose_version)
    REFERENCES os_consent_purposes (purpose_key, version)
);

CREATE INDEX IF NOT EXISTS os_data_exports_buyer_idx
  ON os_data_exports (buyer_name, delivered_at DESC);
CREATE INDEX IF NOT EXISTS os_data_exports_purpose_idx
  ON os_data_exports (purpose_key, delivered_at DESC);

-- ---------------------------------------------------------------------
-- 4. Data erasure requests — GDPR right-to-erasure workflow
--
-- When a party requests erasure, this row records the request, the
-- assessed resolution (full delete vs anonymise-and-retain), the
-- reasoning, and the completion state. Resolution matters because
-- graph value depends on retained outcome data — Sarah's identity
-- can be deleted, but her review's contribution to edge weighting
-- can be anonymised and retained under legitimate-interests basis.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_data_erasure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_via text,                       -- "email", "portal", "written"
  request_notes text,
  request_evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  -- Assessment
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received',
      'in_review',
      'awaiting_evidence',
      'resolution_agreed',
      'executing',
      'completed',
      'rejected',
      'partially_completed'
    )),
  resolution text
    CHECK (resolution IN (
      'full_delete',                        -- hard delete of identity + attribution
      'anonymise_and_retain',                -- identity deleted, outcome data anonymised
      'partial',                             -- category-by-category resolution
      'rejected'                             -- with legal basis
    )),
  resolution_reasoning text,
  scheduled_execution_at timestamptz,
  executed_at timestamptz,
  executed_by uuid,                         -- staff party id
  execution_evidence jsonb,                 -- structured audit trail of what was deleted

  -- SLA
  legal_deadline timestamptz                -- 30 days from receipt in UK/EU
    GENERATED ALWAYS AS (requested_at + interval '30 days') STORED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_data_erasure_requests_party_idx
  ON os_data_erasure_requests (party_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS os_data_erasure_requests_status_idx
  ON os_data_erasure_requests (status, legal_deadline);
CREATE INDEX IF NOT EXISTS os_data_erasure_requests_deadline_idx
  ON os_data_erasure_requests (legal_deadline)
  WHERE status NOT IN ('completed','rejected');

-- ---------------------------------------------------------------------
-- 5. Seed the initial purpose registry
--
-- Version 1 of every purpose we might ever need consent for. Keeping
-- them all here at v1 gives us the reference implementation — new
-- versions supersede these when copy or scope changes.
-- ---------------------------------------------------------------------
INSERT INTO os_consent_purposes
  (purpose_key, version, headline, description, data_categories, legal_basis, retention_days)
VALUES
  ('ecosystem_display', 1,
   'Show your business in the ecosystem',
   'Your business appears in Trade Circle pages, banner rotations, and search results across XRatedTrade so homeowners and other merchants can discover you.',
   ARRAY['identity','contact','location','content'],
   'contract',
   NULL),

  ('behavioural_telemetry', 1,
   'Improve your experience via anonymous telemetry',
   'We record which pages you view, which searches you run, and which businesses you save. Used to personalise your discovery feed and improve the platform.',
   ARRAY['behavioural'],
   'legitimate_interests',
   365),

  ('recommendation_matching', 1,
   'Use your project data to match you with trusted trades',
   'When you submit a project or invite a business, we use the details (property location, project scope, budget) to recommend trades from the ecosystem.',
   ARRAY['identity','contact','location','content'],
   'contract',
   1095),

  ('marketing_communications', 1,
   'Receive updates from XRatedTrade',
   'Product updates, seasonal offers, and platform news. You can unsubscribe at any time.',
   ARRAY['contact'],
   'consent',
   NULL),

  ('manufacturer_data_seat', 1,
   'Share anonymised project intent with manufacturers',
   'Aggregated, anonymised statistics about project types, geographies, and product demand are shared with manufacturers who buy our intelligence products. Individual identities are never included.',
   ARRAY['behavioural','content'],
   'legitimate_interests',
   NULL),

  ('insurer_risk_signal', 1,
   'Share verified renovation history with your insurer',
   'When you request it, we can share your verified renovation history with your home insurer to reduce your premium.',
   ARRAY['identity','location','content'],
   'consent',
   3650),

  ('lender_valuation_intelligence', 1,
   'Share verified property state with your lender',
   'When you request it, we can share your property''s verified state with your mortgage lender to support valuation.',
   ARRAY['identity','location','content'],
   'consent',
   3650),

  ('regulatory_disclosure', 1,
   'Comply with legal and regulatory requirements',
   'We may be required to share limited data with regulators, tax authorities, or law enforcement. We retain records of when and why this happens.',
   ARRAY['identity','contact','location','content'],
   'legal_obligation',
   NULL)
ON CONFLICT (purpose_key, version) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_data_erasure_requests'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- os_consent_grants + os_data_exports are append-only (never updated).
-- os_consent_purposes is versioned (superseded_at set on retirement, not updated).

-- ---------------------------------------------------------------------
-- 7. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_consent_purposes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_consent_grants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_data_exports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_data_erasure_requests    ENABLE ROW LEVEL SECURITY;

COMMIT;
