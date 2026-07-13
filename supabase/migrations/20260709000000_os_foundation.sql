-- XRatedTrade OS — Foundation Layer.
--
-- The primary key of the entire OS is the PROPERTY. Every workflow —
-- visualise, quote, install, warranty, review, referral — pivots on
-- a UK address. Nothing in this file is app-specific; these are
-- platform primitives that every future app plugs into via the
-- extension pattern (app_<slug>_*).
--
-- Naming convention: os_* prefix for foundation tables so no app is
-- ever tempted to imagine it owns them.
--
-- Objects introduced:
--   os_parties              — a person or a business identity
--   os_properties           — a UK address
--   os_property_claims      — party × property × role × status
--   os_projects             — a body of work at a property
--   os_specifications       — versioned BOM tied to a project
--   os_home_timeline_events — immutable, per-property, per-verb event log
--   os_documents            — a file with provenance + consent
--
-- Design principles enforced here:
--   • Property is atomic — not merchant, not project.
--   • Every claim has a role (owner / occupier / agent) and a status
--     (self / verified / disputed) so trust can grow over time.
--   • Timeline is immutable + additive — never updated in place.
--   • RLS: claimants can read their property + descendants; nothing
--     else. Service-role writes happen through server helpers.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Parties (person or business)
--
-- os_parties is the universal identity row for anyone on the platform.
-- Businesses (hammerex_trade_off_listings) will get their party_id
-- back-filled in a later migration; for v1 we only auto-create for
-- homeowners registering through AI Visualiser.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('person', 'business')),
  display_name text NOT NULL,
  email text,
  email_hash text,
  whatsapp_e164 text,
  whatsapp_hash text,
  -- Party may be linked to an existing business row (merchant/trade)
  business_listing_id uuid,
  -- Auth linkage — nullable so we can create parties before they log in
  supabase_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_parties_email_hash_uk
  ON os_parties (email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_parties_whatsapp_hash_idx
  ON os_parties (whatsapp_hash) WHERE whatsapp_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_parties_business_listing_idx
  ON os_parties (business_listing_id) WHERE business_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_parties_supabase_user_idx
  ON os_parties (supabase_user_id) WHERE supabase_user_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Properties (UK addresses)
--
-- UPRN (Unique Property Reference Number) is the HMLR national key. We
-- record it when known; postcode+address hash is our fallback dedup.
-- Address matching is loose — we normalise for hash but preserve the
-- user-supplied form in `address_lines` for display.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uprn bigint,                                -- HMLR key when known
  address_hash text NOT NULL,                 -- sha256(normalised address)
  address_lines text[] NOT NULL DEFAULT '{}',
  city text,
  postcode text NOT NULL,                     -- normalised, upper, no space
  country text NOT NULL DEFAULT 'GB',
  lat numeric(9,6),
  lng numeric(9,6),
  voa_property_type text,                     -- 'S' semi, 'T' terrace, 'D' detached, 'F' flat
  bedrooms integer,
  built_year integer,
  tenure text CHECK (tenure IS NULL OR tenure IN ('freehold','leasehold','shared_ownership','rental')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_properties_uprn_uk
  ON os_properties (uprn) WHERE uprn IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS os_properties_address_hash_uk
  ON os_properties (address_hash);
CREATE INDEX IF NOT EXISTS os_properties_postcode_idx
  ON os_properties (postcode);

-- ---------------------------------------------------------------------
-- 3. Property claims (party × property × role × status)
--
-- Claim expresses "party X has role Y over property Z with trust status T".
-- role:    owner / occupier / agent / previous_owner
-- status:  self (unverified) / verified (HMLR / postal check / doc upload) / disputed
--
-- Multiple claims allowed per property (couples own together, tenants
-- occupy while owner still holds title). Transfer at property sale is
-- a new claim for the buyer with status='self' and the old owner's
-- claim moved to role='previous_owner'.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_property_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','occupier','agent','previous_owner')),
  status text NOT NULL DEFAULT 'self' CHECK (status IN ('self','verified','disputed','revoked')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  revoked_at timestamptz,
  evidence_document_id uuid,      -- FK to os_documents added later
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_property_claims_property_idx
  ON os_property_claims (property_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS os_property_claims_party_idx
  ON os_property_claims (party_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS os_property_claims_uk
  ON os_property_claims (property_id, party_id, role) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- 4. Projects (bodies of work at a property)
--
-- Every project belongs to a property. Optional link to a business (the
-- primary trade/merchant working on it). Leaf slug matches the AI
-- Visualiser taxonomy so kitchens/bathrooms/staircases share vocabulary.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  primary_party_id uuid REFERENCES os_parties(id),
  primary_business_listing_id uuid,     -- merchant/trade doing the work
  title text NOT NULL,                  -- e.g. "Kitchen renovation"
  leaf_slug text,                       -- taxonomy leaf (kitchen_full, bathroom_full, etc.)
  status text NOT NULL DEFAULT 'idea' CHECK (status IN (
    'idea','specced','quoted','accepted','surveyed','in_progress',
    'signed_off','closed','abandoned'
  )),
  budget_pence_low integer,
  budget_pence_high integer,
  target_start_date date,
  target_end_date date,
  actual_start_date date,
  actual_end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_projects_property_idx
  ON os_projects (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS os_projects_business_idx
  ON os_projects (primary_business_listing_id, status) WHERE primary_business_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_projects_leaf_idx
  ON os_projects (leaf_slug) WHERE leaf_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_projects_status_idx
  ON os_projects (status, updated_at DESC);

-- ---------------------------------------------------------------------
-- 5. Specifications (versioned BOMs)
--
-- A Specification is the structured description of what the customer
-- wants: style + material + colour + hardware + product SKUs +
-- quantities. Every render, quote, order, warranty pivots on the
-- Specification. Versioned so we can see how the customer's mind
-- changed over the sales cycle.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  leaf_slug text NOT NULL,        -- taxonomy binding
  choices jsonb NOT NULL,         -- {style, material, colour, hardware[]}
  bom jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{sku, qty, unit_price_pence, source_business_id}]
  total_pence integer,
  authored_by_party_id uuid REFERENCES os_parties(id),
  authored_by_business_listing_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_specifications_project_version_idx
  ON os_specifications (project_id, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS os_specifications_project_version_uk
  ON os_specifications (project_id, version);

-- ---------------------------------------------------------------------
-- 6. Home Timeline events (per-property immutable log)
--
-- Every module writes into here. Never updated. Never deleted (subject
-- to GDPR delete which is a full-purge, not an edit). Powers:
--   • the Home Timeline UI on /home
--   • property valuation at sale
--   • cross-project referral suggestions
--   • warranty & maintenance reminders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_home_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES os_projects(id) ON DELETE SET NULL,
  actor_party_id uuid REFERENCES os_parties(id),
  actor_business_listing_id uuid,
  verb text NOT NULL,                -- e.g. 'property.claimed', 'render.completed', 'warranty.registered'
  subject_type text NOT NULL,        -- 'project' | 'render' | 'warranty' | 'quote' | 'order' | 'document'
  subject_id uuid,
  headline text NOT NULL,            -- one line for UI
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_timeline_property_occurred_idx
  ON os_home_timeline_events (property_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS os_timeline_project_idx
  ON os_home_timeline_events (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_timeline_verb_idx
  ON os_home_timeline_events (verb);
-- Idempotency: writers pass (verb, subject_id) and this index enforces one row per pair
CREATE UNIQUE INDEX IF NOT EXISTS os_timeline_verb_subject_uk
  ON os_home_timeline_events (verb, subject_id) WHERE subject_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 7. Documents (files with consent + provenance)
--
-- Every file that matters — receipts, EPCs, deeds, warranties, insurance
-- certificates — lands here. Scoped to a property OR a party OR a project.
-- Media Library (photos) is separate; this table is for documents that
-- have legal / warranty / evidence weight.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES os_properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES os_projects(id) ON DELETE CASCADE,
  owning_party_id uuid REFERENCES os_parties(id),
  kind text NOT NULL CHECK (kind IN (
    'receipt','invoice','warranty','epc','deed','insurance','contract',
    'plan','certificate','other'
  )),
  title text NOT NULL,
  file_url text NOT NULL,           -- signed URL to storage
  mime_type text,
  size_bytes integer,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb, -- {app_slug, capture_method, verified_by}
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,    -- who can view; homeowner default
  expires_at timestamptz,           -- warranties + insurance certs expire
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_documents_property_idx
  ON os_documents (property_id, created_at DESC) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_documents_project_idx
  ON os_documents (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_documents_party_idx
  ON os_documents (owning_party_id) WHERE owning_party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_documents_expires_idx
  ON os_documents (expires_at) WHERE expires_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- Touch triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_parties',
      'os_properties',
      'os_property_claims',
      'os_projects',
      'os_documents'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- RLS
--
-- Foundation policy: everything is service-role-only from the anon
-- client. All access goes through server-side helpers that establish
-- party identity via cookie session, then apply the read policy at
-- the query level.
-- ---------------------------------------------------------------------
ALTER TABLE os_parties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_properties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_property_claims       ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_specifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_home_timeline_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_documents             ENABLE ROW LEVEL SECURITY;

-- Deny-by-default is what "RLS enabled + no policies" gives us. This is
-- correct — the OS never exposes these tables via anon client. All
-- reads use the service role through explicit server routes that
-- perform their own ownership checks.

-- ---------------------------------------------------------------------
-- Deferred FK from os_property_claims.evidence_document_id
-- ---------------------------------------------------------------------
ALTER TABLE os_property_claims
  DROP CONSTRAINT IF EXISTS os_property_claims_evidence_document_fk;
ALTER TABLE os_property_claims
  ADD CONSTRAINT os_property_claims_evidence_document_fk
  FOREIGN KEY (evidence_document_id) REFERENCES os_documents(id) ON DELETE SET NULL;

COMMIT;
