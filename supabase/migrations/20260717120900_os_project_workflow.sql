-- XRatedTrade OS — Workflow Capture (Phase 2, part 1/3).
--
-- This is THE load-bearing bet — the primitives that turn Trade Circle
-- edges from self-reported endorsements into transaction-verified
-- relationships. Every job completed on-platform strengthens the graph
-- with real evidence:
--
--   Merchant A + Merchant B complete a job together
--        → os_project_participants records both
--        → os_project_signoffs records completion
--        → os_project_reviews (next migration) records outcome
--        → event fires → os_business_endorsements edge weight strengthens
--                        AND endorsement_type may auto-flip to 'job_verified'
--
-- Without workflow capture, endorsements are LinkedIn Skills (worthless).
-- With workflow capture, they become medical referrals (uncopyable).
--
-- Six objects in this migration:
--   os_project_participants        — many-to-many party × business × role
--   os_project_quotes              — quote lifecycle with state machine
--   os_project_quote_line_items    — structured line items on quotes
--   os_project_milestones          — deposit, mid-check, completion, warranty
--   os_project_signoffs            — homeowner approval events
--   os_project_status_events       — status transition log for os_projects
--
-- os_projects already exists with a 9-state status machine and a
-- single primary_business_listing_id. This migration adds multi-party
-- participation without breaking the primary-party contract.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_project_participants — who is on this project
--
-- Extends os_projects.primary_business_listing_id (still authoritative
-- for "the main merchant") with a many-to-many table for every party
-- involved: homeowner, main contractor, sub-trades, suppliers, agents.
--
-- Roles align with UK trade reality: main_contractor delegates to
-- sub_trades; supplier delivers to main_contractor; homeowner and
-- agent approve.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,

  role text NOT NULL
    CHECK (role IN (
      'homeowner',                         -- the property occupier / owner
      'agent',                             -- managing agent acting for owner
      'main_contractor',                   -- lead merchant, quotes the whole job
      'sub_trade',                         -- brought in by main contractor
      'supplier',                          -- material supplier
      'manufacturer',                      -- product-side (kitchen manufacturer etc)
      'surveyor',                          -- independent survey / QS
      'inspector'                          -- building control / warranty inspector
    )),

  -- Financial share (when applicable) — always in pence, always documented.
  -- share_type='fixed_amount' → share_pence is the total. 'percentage' →
  -- share_pence is the number of basis points × 100 (so 25% = 250000).
  share_type text CHECK (share_type IN ('fixed_amount','percentage')),
  share_pence integer,

  -- Validity window — participants can join and leave a project
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  left_reason text,

  -- Invitation provenance (who added them, from which flow)
  invited_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  invited_via text
    CHECK (invited_via IN (
      'primary_creation',                  -- auto-created with the project
      'homeowner_invite',                  -- Sarah added them
      'contractor_add',                    -- main contractor brought them in
      'trade_circle_click',                -- discovered via Trade Circle
      'directory_search',                  -- discovered via /find
      'auto_matched'                       -- system-suggested
    )),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Every participant must have EITHER a party or a business (usually both)
  CONSTRAINT os_project_participants_has_identity
    CHECK (party_id IS NOT NULL OR business_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS os_project_participants_project_idx
  ON os_project_participants (project_id, role)
  WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS os_project_participants_party_idx
  ON os_project_participants (party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_participants_business_idx
  ON os_project_participants (business_id) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_participants_role_active_idx
  ON os_project_participants (role) WHERE left_at IS NULL;

-- ---------------------------------------------------------------------
-- 2. os_project_quotes — quote records with state machine
--
-- A project may have multiple quotes over its life (initial estimate,
-- revised after survey, variation orders). Each quote is a first-class
-- object with a state machine, not just a status enum on os_projects.
--
-- Quote references a specification version so we always know what was
-- being priced.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  quote_number text NOT NULL,              -- merchant-facing reference
  version integer NOT NULL DEFAULT 1,

  -- Who's quoting for whom
  quoting_business_id uuid NOT NULL
    REFERENCES os_business_listings(id) ON DELETE RESTRICT,
  quoting_participant_id uuid
    REFERENCES os_project_participants(id) ON DELETE SET NULL,
  addressed_to_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- What's being quoted
  specification_id uuid REFERENCES os_specifications(id) ON DELETE SET NULL,
  spec_snapshot jsonb,                     -- frozen at quote time for legal reasons
  summary text NOT NULL,                   -- one-line description

  -- Money (all in pence, GBP)
  subtotal_pence integer NOT NULL DEFAULT 0,
  vat_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',

  -- Terms
  valid_until date,
  payment_terms text,                      -- freeform ("50% deposit, balance on completion")
  timeline_estimate text,                  -- freeform ("3-5 working days")
  inclusions text,
  exclusions text,
  notes text,

  -- State machine
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN (
      'draft',                             -- being written
      'sent',                              -- delivered to homeowner
      'viewed',                            -- homeowner opened
      'accepted',                          -- homeowner accepted
      'rejected',                          -- homeowner rejected with reason
      'revised',                           -- superseded by newer version
      'expired',                           -- valid_until passed without decision
      'withdrawn'                          -- merchant withdrew
    )),
  state_reason text,

  -- Lifecycle timestamps
  drafted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  withdrawn_at timestamptz,

  -- Delivery
  delivery_channel text CHECK (delivery_channel IN ('platform','email','whatsapp','print')),
  delivery_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_project_quotes_number_version_uk
    UNIQUE (quoting_business_id, quote_number, version)
);

CREATE INDEX IF NOT EXISTS os_project_quotes_project_idx
  ON os_project_quotes (project_id, drafted_at DESC);
CREATE INDEX IF NOT EXISTS os_project_quotes_business_idx
  ON os_project_quotes (quoting_business_id, state, drafted_at DESC);
CREATE INDEX IF NOT EXISTS os_project_quotes_state_idx
  ON os_project_quotes (state, drafted_at DESC);
CREATE INDEX IF NOT EXISTS os_project_quotes_addressed_to_idx
  ON os_project_quotes (addressed_to_party_id) WHERE addressed_to_party_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. os_project_quote_line_items — structured line items
--
-- Line items are structured (not just PDF) so they can be:
--   • aggregated for pricing intelligence
--   • matched to canonical products
--   • fed into manufacturer demand-forecasting
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES os_project_quotes(id) ON DELETE CASCADE,

  line_number integer NOT NULL,
  category text,                           -- 'labour','materials','plant_hire','waste'
  description text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit text,                               -- 'hours','m2','each','day'
  unit_price_pence integer NOT NULL DEFAULT 0,
  line_total_pence integer NOT NULL DEFAULT 0,
  vat_rate_bps integer NOT NULL DEFAULT 2000,  -- basis points × 100 = 20%
  vat_pence integer NOT NULL DEFAULT 0,

  -- Optional product linkage
  product_sku text,
  canonical_product_id uuid,               -- soft ref to future products layer
  source_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_project_quote_line_items_number_uk
    UNIQUE (quote_id, line_number)
);

CREATE INDEX IF NOT EXISTS os_project_quote_line_items_quote_idx
  ON os_project_quote_line_items (quote_id, line_number);
CREATE INDEX IF NOT EXISTS os_project_quote_line_items_product_idx
  ON os_project_quote_line_items (product_sku) WHERE product_sku IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. os_project_milestones — deposit / mid-check / completion / warranty
--
-- Every project has expected milestones with target dates. Milestones
-- are created up-front (from the quote's payment_terms) then marked
-- completed as they occur. Forms the audit trail for job progress.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,

  milestone_type text NOT NULL
    CHECK (milestone_type IN (
      'deposit_due',
      'deposit_received',
      'materials_ordered',
      'materials_delivered',
      'work_started',
      'mid_check',                         -- interim inspection
      'stage_payment_due',
      'stage_payment_received',
      'work_completed',
      'homeowner_signoff',
      'final_payment_due',
      'final_payment_received',
      'warranty_registered',
      'aftercare_visit',
      'defect_remediation'
    )),
  sequence integer NOT NULL,
  title text NOT NULL,                     -- human-readable summary
  description text,

  -- Money (when applicable)
  amount_pence integer,

  -- Timing
  target_date date,
  completed_at timestamptz,
  completed_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  completion_evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
  completion_notes text,

  -- State
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped','disputed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_milestones_project_idx
  ON os_project_milestones (project_id, sequence);
CREATE INDEX IF NOT EXISTS os_project_milestones_status_idx
  ON os_project_milestones (status, target_date);
CREATE INDEX IF NOT EXISTS os_project_milestones_pending_idx
  ON os_project_milestones (project_id, status)
  WHERE status IN ('pending','in_progress');

-- ---------------------------------------------------------------------
-- 5. os_project_signoffs — homeowner approval events
--
-- The load-bearing verification primitive. A signoff is homeowner-side
-- structured approval that a milestone (usually completion) was
-- satisfactory. Signoff at completion is what turns the job into a
-- 'job_verified' evidence source for the endorsement graph.
--
-- Photos + notes + optional homeowner satisfaction rating captured.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES os_project_milestones(id) ON DELETE SET NULL,

  signoff_type text NOT NULL
    CHECK (signoff_type IN (
      'stage_signoff',                     -- interim approval
      'work_completion',                   -- main sign-off
      'defect_remediation_signoff',        -- after fix
      'warranty_activation_signoff',
      'dispute_settlement_signoff'
    )),

  signed_off_by_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,
  signed_off_role text NOT NULL
    CHECK (signed_off_role IN ('homeowner','agent','guardian','joint')),
  signed_off_at timestamptz NOT NULL DEFAULT now(),

  -- Satisfaction (optional at signoff — full review is separate)
  satisfaction_score integer
    CHECK (satisfaction_score IS NULL OR satisfaction_score BETWEEN 1 AND 5),
  satisfaction_notes text,

  -- Evidence
  photo_urls text[] NOT NULL DEFAULT '{}',
  supporting_document_ids uuid[] NOT NULL DEFAULT '{}',

  -- Legal / consent
  signature_type text
    CHECK (signature_type IN ('typed_name','drawn','pin_confirmation','biometric','witness_attested')),
  signature_data jsonb,                    -- structured signature evidence
  ip_hash text,
  user_agent text,

  -- Reversal
  reversed_at timestamptz,
  reversed_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  reversal_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_signoffs_project_idx
  ON os_project_signoffs (project_id, signed_off_at DESC)
  WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS os_project_signoffs_party_idx
  ON os_project_signoffs (signed_off_by_party_id, signed_off_at DESC);
CREATE INDEX IF NOT EXISTS os_project_signoffs_milestone_idx
  ON os_project_signoffs (milestone_id) WHERE milestone_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. os_project_status_events — append-only status transition log
--
-- Every time os_projects.status changes, an event is written. Enables
-- "how long did this project stay in 'quoted' before 'accepted'?"
-- queries — critical for pilot funnel intelligence and pricing model.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,

  from_status text,                        -- null on creation event
  to_status text NOT NULL,
  triggered_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  triggered_by_role text,                  -- 'homeowner','main_contractor','system'
  triggered_by_action text,                -- 'quote_accepted','signoff','manual'
  linked_quote_id uuid REFERENCES os_project_quotes(id) ON DELETE SET NULL,
  linked_signoff_id uuid REFERENCES os_project_signoffs(id) ON DELETE SET NULL,
  linked_milestone_id uuid REFERENCES os_project_milestones(id) ON DELETE SET NULL,

  transitioned_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS os_project_status_events_project_idx
  ON os_project_status_events (project_id, transitioned_at DESC);
CREATE INDEX IF NOT EXISTS os_project_status_events_to_status_idx
  ON os_project_status_events (to_status, transitioned_at DESC);

-- ---------------------------------------------------------------------
-- 7. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_project_participants',
      'os_project_quotes',
      'os_project_milestones',
      'os_project_signoffs'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Line items + status events are append-only.

-- ---------------------------------------------------------------------
-- 8. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_project_participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_quotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_quote_line_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_signoffs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_status_events       ENABLE ROW LEVEL SECURITY;

COMMIT;
