-- XRatedTrade OS — Verifications (Phase 2, part 2/3).
--
-- Reviews, warranties, disputes — the primitives that turn a signed-off
-- job into verified evidence for the Trade Circle graph.
--
-- Design principle: reviews are TIED TO JOBS, not merchant profiles.
-- A review is only writable by a homeowner who signed off a specific
-- project. This kills the review-farming problem plaguing every UK
-- directory competitor — no one can pay for reviews because reviews
-- require a real completed job.
--
-- Warranties are FIRST-CLASS INSTRUMENTS, not PDFs. Structured terms
-- means we can:
--   • auto-remind before expiry (retention hook for homeowner)
--   • verify claim validity in seconds (insurer data product)
--   • bundle for securitisation at Year 5+
--
-- Disputes have structured evidence + resolution states so the graph
-- can distinguish "one bad review" from "settled amicably" from
-- "unresolved allegation."

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_project_reviews — job-tied reviews
--
-- CRITICAL DESIGN CHOICE: reviews require a project_id + a party_id
-- whose signoff exists on that project. Anonymous reviews impossible
-- by design. Review-farming impossible by design.
--
-- Reviews are per-BUSINESS-per-PROJECT so a homeowner can review each
-- merchant on a project separately (main contractor and sub-trade).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  reviewed_business_id uuid NOT NULL
    REFERENCES os_business_listings(id) ON DELETE CASCADE,
  reviewer_party_id uuid NOT NULL
    REFERENCES os_parties(id) ON DELETE RESTRICT,
  reviewer_role text NOT NULL
    CHECK (reviewer_role IN ('homeowner','agent','main_contractor','sub_trade')),

  -- The verification hook — must reference the sign-off that entitles
  -- this review to exist. Set NULL when signoff is deleted so the
  -- FK is preserved; server code enforces "no signoff → no review"
  -- at write time.
  verifying_signoff_id uuid REFERENCES os_project_signoffs(id) ON DELETE SET NULL,

  -- Star ratings
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
  quality_score integer CHECK (quality_score BETWEEN 1 AND 5),
  timeliness_score integer CHECK (timeliness_score BETWEEN 1 AND 5),
  communication_score integer CHECK (communication_score BETWEEN 1 AND 5),
  value_score integer CHECK (value_score BETWEEN 1 AND 5),
  cleanliness_score integer CHECK (cleanliness_score BETWEEN 1 AND 5),

  -- Content
  headline text,
  body text NOT NULL,
  would_recommend boolean,
  photo_urls text[] NOT NULL DEFAULT '{}',

  -- Merchant response (single, editable)
  merchant_response text,
  merchant_responded_at timestamptz,
  merchant_response_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Moderation
  moderation_status text NOT NULL DEFAULT 'published'
    CHECK (moderation_status IN ('pending','published','hidden','removed','disputed')),
  moderation_notes text,
  moderated_at timestamptz,
  moderated_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Homeowner ability to edit
  editable_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_edited_at timestamptz,

  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One review per (project, business, reviewer) — no double-review
  CONSTRAINT os_project_reviews_unique
    UNIQUE (project_id, reviewed_business_id, reviewer_party_id)
);

CREATE INDEX IF NOT EXISTS os_project_reviews_business_idx
  ON os_project_reviews (reviewed_business_id, submitted_at DESC)
  WHERE moderation_status = 'published';
CREATE INDEX IF NOT EXISTS os_project_reviews_project_idx
  ON os_project_reviews (project_id);
CREATE INDEX IF NOT EXISTS os_project_reviews_reviewer_idx
  ON os_project_reviews (reviewer_party_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS os_project_reviews_moderation_idx
  ON os_project_reviews (moderation_status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS os_project_reviews_score_idx
  ON os_project_reviews (reviewed_business_id, overall_score)
  WHERE moderation_status = 'published';

-- ---------------------------------------------------------------------
-- 2. os_project_warranties — warranty instruments
--
-- A warranty is a legal instrument, not a PDF. Structured terms mean
-- we know when it expires, what's covered, who the backing party is,
-- and how transferable it is (survives property sale?).
--
-- Retention hook: reminders before expiry drive homeowner return.
-- Insurance data product: verified warranty state per property.
-- Property Passport: transferable warranty history at sale.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,

  -- The parties involved
  warrantor_business_id uuid NOT NULL
    REFERENCES os_business_listings(id) ON DELETE RESTRICT,
  beneficiary_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- What's covered
  warranty_type text NOT NULL
    CHECK (warranty_type IN (
      'workmanship',
      'materials',
      'combined',                          -- workmanship + materials
      'manufacturer_backed',
      'insurance_backed',
      'guarantee_only'                     -- non-warranty commitment
    )),
  scope text NOT NULL,                     -- freeform "kitchen units and worktops"
  linked_specification_id uuid REFERENCES os_specifications(id) ON DELETE SET NULL,
  covered_product_skus text[] NOT NULL DEFAULT '{}',

  -- Terms
  term_months integer NOT NULL,
  starts_at date NOT NULL,
  expires_at date NOT NULL,

  -- Legal properties
  transferable_on_sale boolean NOT NULL DEFAULT false,
  transfer_conditions text,
  claim_procedure text NOT NULL,           -- how to file a claim
  exclusions text,
  policy_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  -- Backing
  backing_type text
    CHECK (backing_type IN (
      'merchant_direct',                   -- merchant is the sole backer
      'manufacturer_scheme',
      'insurance_policy',
      'industry_scheme'                    -- e.g., Which? Trusted Trader
    )),
  backing_reference text,                  -- policy number, scheme ID

  -- State
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','claimed','expired','void','transferred')),

  -- Transfer trail (property sold, new owner picked up warranty)
  transferred_at timestamptz,
  transferred_from_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  transferred_to_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_warranties_property_idx
  ON os_project_warranties (property_id, expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS os_project_warranties_business_idx
  ON os_project_warranties (warrantor_business_id, status);
CREATE INDEX IF NOT EXISTS os_project_warranties_expiry_idx
  ON os_project_warranties (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS os_project_warranties_beneficiary_idx
  ON os_project_warranties (beneficiary_party_id) WHERE beneficiary_party_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. os_project_disputes — structured dispute records
--
-- When something goes wrong. Structured so:
--   • Both sides can add evidence
--   • Resolution is recorded with reasoning
--   • Graph knows this pair had a dispute (edge weight adjustment)
--   • Reviews written during dispute are marked 'disputed'
--   • Insurer / regulator can audit
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,

  -- Who's arguing
  raised_by_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,
  raised_by_role text NOT NULL
    CHECK (raised_by_role IN ('homeowner','main_contractor','sub_trade','supplier','agent')),
  against_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,
  against_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- What it's about
  dispute_type text NOT NULL
    CHECK (dispute_type IN (
      'workmanship_defect',
      'material_defect',
      'incomplete_work',
      'timeline_delay',
      'cost_overrun',
      'unauthorised_variation',
      'non_payment',
      'damage_to_property',
      'warranty_denial',
      'other'
    )),
  summary text NOT NULL,
  claimed_remedy text,                     -- what the raiser wants
  claimed_amount_pence integer,

  -- State machine
  state text NOT NULL DEFAULT 'raised'
    CHECK (state IN (
      'raised',
      'under_discussion',
      'mediation',                         -- platform-facilitated
      'formal_process',                    -- external adjudication
      'resolved_amicable',
      'resolved_platform_ruling',
      'resolved_external',
      'withdrawn',
      'stale'
    )),

  raised_at timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  resolution_summary text,
  resolution_evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  -- Graph impact
  impacts_edge_weight boolean NOT NULL DEFAULT true,
  edge_weight_adjustment numeric(5,3),     -- multiplier applied to related edges

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_disputes_project_idx
  ON os_project_disputes (project_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS os_project_disputes_against_business_idx
  ON os_project_disputes (against_business_id, state)
  WHERE against_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_disputes_state_idx
  ON os_project_disputes (state, raised_at DESC);
CREATE INDEX IF NOT EXISTS os_project_disputes_open_idx
  ON os_project_disputes (raised_at DESC)
  WHERE state NOT IN ('resolved_amicable','resolved_platform_ruling',
                       'resolved_external','withdrawn','stale');

-- ---------------------------------------------------------------------
-- 4. os_project_dispute_evidence — append-only evidence log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES os_project_disputes(id) ON DELETE CASCADE,

  submitted_by_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,
  submitted_by_side text NOT NULL
    CHECK (submitted_by_side IN ('raiser','respondent','mediator','third_party')),

  evidence_type text NOT NULL
    CHECK (evidence_type IN (
      'photo','video','document','quote_snapshot','signoff_snapshot',
      'message_transcript','invoice','statement','expert_report','other'
    )),
  description text,
  document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
  attachment_url text,

  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_dispute_evidence_dispute_idx
  ON os_project_dispute_evidence (dispute_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS os_project_dispute_evidence_party_idx
  ON os_project_dispute_evidence (submitted_by_party_id, submitted_at DESC);

-- ---------------------------------------------------------------------
-- 5. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_project_reviews',
      'os_project_warranties',
      'os_project_disputes'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Dispute evidence is append-only.

-- ---------------------------------------------------------------------
-- 6. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_project_reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_warranties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_dispute_evidence   ENABLE ROW LEVEL SECURITY;

COMMIT;
