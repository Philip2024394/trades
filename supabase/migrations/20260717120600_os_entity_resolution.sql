-- XRatedTrade OS — Entity Resolution (Phase 1.5, gap 2/4).
--
-- People, businesses, and properties mutate constantly. Over a decade:
--   • ~30% of small businesses restructure, acquire, or dissolve
--   • Employees move companies, taking trust relationships with them
--   • Properties split (flat conversion), merge, get redeveloped,
--     get renumbered by councils
--   • Ownership transfers preserve the property but change the party
--
-- This migration ships the lineage + role-binding primitives that
-- keep the graph coherent across all of these transitions. Named as
-- one of the five irreversible Year-One decisions in Chief Architect
-- Review #4 — get it wrong at Year 1 and five years of edges attach
-- to the wrong nodes.
--
-- Four objects:
--   os_property_lineage_events        — splits, merges, redevs, renumbering
--   os_property_role_bindings         — party × property × role × validity
--   os_business_lineage_events        — restructure, name change, M&A
--   os_business_verification_snapshots — Companies House rechecks over time

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Property lineage events — the property's DNA history
--
-- Every time a property changes shape (subdivided, merged, demolished,
-- renumbered, retitled) we write a lineage event. The property row's
-- id stays stable; the lineage record explains what happened. This
-- lets us answer questions like "was this property under a different
-- title in 2027?" without losing history.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_property_lineage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,

  event_type text NOT NULL
    CHECK (event_type IN (
      'subdivision',                        -- 1 → N properties (this is a child)
      'merger',                             -- N → 1 (this is the survivor)
      'redevelopment',                      -- demolition + new build, same footprint
      'renumbering',                        -- council renumbered the street
      'title_change',                       -- new Land Registry title
      'uprn_assignment',                    -- HMLR assigned or updated UPRN
      'address_correction',                 -- our address string was wrong
      'reclassification'                    -- residential ↔ commercial ↔ HMO ↔ BTR
    )),

  -- Relationships to other properties involved
  parent_property_ids uuid[] NOT NULL DEFAULT '{}',    -- properties this came from
  child_property_ids uuid[] NOT NULL DEFAULT '{}',     -- properties this produced

  -- Before/after snapshots
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,     -- address, uprn, title etc
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance
  authoritative_source text,               -- "hmlr", "council_notification", "self_report"
  source_reference text,                   -- title number, planning ref, etc.
  effective_at date NOT NULL,              -- when the change actually took effect
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  notes text
);

CREATE INDEX IF NOT EXISTS os_property_lineage_events_property_idx
  ON os_property_lineage_events (property_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS os_property_lineage_events_type_idx
  ON os_property_lineage_events (event_type, effective_at DESC);
CREATE INDEX IF NOT EXISTS os_property_lineage_events_source_idx
  ON os_property_lineage_events (authoritative_source);

-- ---------------------------------------------------------------------
-- 2. Property role bindings — who's connected to this property
--
-- Sarah (owner) 2025-2028. Then she sells. New owner Tom (owner)
-- 2028-2034. Then he leases to Ali (tenant) 2029-2032. Property
-- record stays. History follows the property. Identities detach on
-- their validity end.
--
-- This is the mechanism that makes the Property Passport survive
-- ownership change — the moat depends on it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_property_role_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,

  role text NOT NULL
    CHECK (role IN (
      'owner',                              -- freehold/leasehold owner
      'tenant',                             -- rental occupier
      'agent',                              -- managing agent
      'occupier',                           -- unspecified resident
      'buyer',                              -- pending completion
      'seller',                             -- pending completion
      'contractor_of_record',               -- ongoing project
      'landlord',                           -- distinct from owner in some HMO cases
      'guardian'                            -- e.g., estate executor
    )),

  -- Validity window
  valid_from date NOT NULL,
  valid_to date,                            -- null = current

  -- Verification state
  verification_status text NOT NULL DEFAULT 'self_reported'
    CHECK (verification_status IN (
      'self_reported',
      'evidence_supplied',
      'authority_verified',                 -- HMLR title match, council tax check
      'disputed',
      'superseded'
    )),
  verification_evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verified_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Provenance
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  notes text
);

-- One "current" binding per (property, party, role) — validity windows must not overlap
CREATE INDEX IF NOT EXISTS os_property_role_bindings_property_idx
  ON os_property_role_bindings (property_id, role, valid_from DESC);
CREATE INDEX IF NOT EXISTS os_property_role_bindings_party_idx
  ON os_property_role_bindings (party_id, valid_from DESC);
CREATE INDEX IF NOT EXISTS os_property_role_bindings_current_idx
  ON os_property_role_bindings (property_id, role) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS os_property_role_bindings_verification_idx
  ON os_property_role_bindings (verification_status);

-- ---------------------------------------------------------------------
-- 3. Business lineage events — how businesses change
--
-- Bright Ltd restructures to Bright Services Ltd. Dave the Sparky
-- forms a Ltd company. Two independents merge into one. Companies
-- House number changes; business_listing_id stays for continuity, or
-- migrates with structured trail.
--
-- Every edge in the graph must survive these transitions or the moat
-- rots silently.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_lineage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,

  event_type text NOT NULL
    CHECK (event_type IN (
      'incorporation',                      -- sole trader → Ltd
      'restructure',                        -- Ltd → LLP, or entity type change
      'name_change',
      'director_change',
      'address_change',
      'acquisition_target',                 -- was acquired by another business
      'acquisition_buyer',                  -- acquired another business
      'merger',                             -- N → 1
      'demerger',                           -- 1 → N
      'dissolution',                        -- ceased trading
      'reactivation',                       -- resumed after dormancy
      'trading_style_change',               -- brand name change without entity change
      'ownership_transfer'                  -- ultimate ownership changed
    )),

  -- Relationships to other business rows
  predecessor_business_ids uuid[] NOT NULL DEFAULT '{}',
  successor_business_ids uuid[] NOT NULL DEFAULT '{}',

  -- Before/after snapshots
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- {"companies_house_number":"12345678","name":"Bright Ltd",
    --  "directors":[{"name":"Dave Smith","from":"2020-01-01"}]}
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Continuity policy — what happens to the graph
  edges_migrate boolean NOT NULL DEFAULT true,
    -- If false, edges stay attached to the OLD business_id and the
    -- new entity starts fresh. Used for hostile splits / disputes.
  reviews_migrate boolean NOT NULL DEFAULT true,
  certifications_migrate boolean NOT NULL DEFAULT true,

  authoritative_source text,               -- "companies_house", "self_report"
  source_reference text,                   -- CH filing id, etc.
  effective_at date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  evidence_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,

  notes text
);

CREATE INDEX IF NOT EXISTS os_business_lineage_events_business_idx
  ON os_business_lineage_events (business_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS os_business_lineage_events_type_idx
  ON os_business_lineage_events (event_type, effective_at DESC);

-- ---------------------------------------------------------------------
-- 4. Business verification snapshots — Companies House rechecks
--
-- Day-0 snapshot lives on os_business_listings.companies_house_snapshot.
-- Every recheck writes a new row here — never mutating the Day-0
-- capture. Enables "was this business active in 2027?" queries and
-- detects silent changes (director change we didn't know about).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_verification_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,

  source text NOT NULL DEFAULT 'companies_house'
    CHECK (source IN ('companies_house','vat_register','gas_safe','napit',
                      'niceic','chas','trustmark','self_declaration')),

  companies_house_number text,
  snapshot jsonb NOT NULL,                 -- full API response frozen at this moment
  snapshot_hash text NOT NULL,             -- sha256 for change detection

  -- Structured derivatives (extracted from snapshot for indexing)
  entity_status text,                      -- 'active', 'dissolved', 'liquidation'
  registered_name text,
  trading_names text[] NOT NULL DEFAULT '{}',
  registered_address text,
  incorporation_date date,
  dissolution_date date,
  officer_count integer,

  -- Diff vs previous snapshot for this business
  changed_fields text[] NOT NULL DEFAULT '{}',
  is_material_change boolean NOT NULL DEFAULT false,

  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by text                          -- 'signup', 'daily_recheck', 'manual'
);

CREATE INDEX IF NOT EXISTS os_business_verification_snapshots_business_idx
  ON os_business_verification_snapshots (business_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS os_business_verification_snapshots_hash_idx
  ON os_business_verification_snapshots (business_id, snapshot_hash);
CREATE INDEX IF NOT EXISTS os_business_verification_snapshots_material_idx
  ON os_business_verification_snapshots (business_id, captured_at DESC)
  WHERE is_material_change = true;

-- ---------------------------------------------------------------------
-- 5. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_property_role_bindings'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Lineage events + verification snapshots are append-only.

-- ---------------------------------------------------------------------
-- 6. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_property_lineage_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_property_role_bindings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_lineage_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_verification_snapshots ENABLE ROW LEVEL SECURITY;

COMMIT;
