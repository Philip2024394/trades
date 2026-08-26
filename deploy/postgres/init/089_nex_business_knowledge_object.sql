-- deploy/postgres/init/089_nex_business_knowledge_object.sql
--
-- BUSINESS KNOWLEDGE OBJECT · polymorphic evidence overlay for food + accommodation
--
-- ONE table both verticals feed. Each row = ONE piece of evidence about ONE attribute
-- of ONE business. The row carries the full SOURCE → CLAIM → INTERPRETATION → UNKNOWN
-- chain so Decision Context can compose honest answers without inventing anything.
--
-- Doctrine anchors:
--   - Truth Invariant (2026-08-22 CONSTITUTIONAL): every claim carries evidence + provenance
--   - Business Knowledge Object three-layer (2026-08-23): evidence overlay separate from
--     the vertical business row · not a rank score · not a recommendation
--   - SOURCE → CLAIM → INTERPRETATION → UNKNOWN → DECISION chain (2026-08-23)
--   - Verified vs Anecdotal source rule (2026-08-23): source_tier enum enforces 5-tier
--     honesty · never presents OWNER_CLAIM as VERIFIED
--   - Reputation Non-Weapon rule: this table stores evidence · scorers/rankers do NOT
--     read it (until a separate greenlit rankable_evidence flag is introduced)
--
-- Bright lines:
--   - NEVER coerce an OWNER_CLAIM row into VERIFIED silently (source_tier immutable per
--     row · new evidence gets a new row · old evidence can be superseded but not rewritten)
--   - NEVER store a bare boolean like "family_safe = true" · store the underlying evidence
--     (changing_table=yes) with interpretation limited to what the evidence supports
--   - NEVER store live-price claims here (transport is a separate Transport Knowledge Object
--     schema · not shipped yet)
--
-- Additive · non-breaking · does not modify any existing table.
-- Rollback: DROP TABLE nex.business_knowledge; DROP TYPE nex.bko_source_tier;
--           DROP TYPE nex.bko_attribute_domain;

BEGIN;

DO $$ BEGIN
  CREATE TYPE nex.bko_source_tier AS ENUM (
    'VERIFIED',      -- Authoritative regulator, government dataset, court record, certified inspection
    'OBSERVED',      -- Direct machine observation (OSM tag, sensor, verified geo-fenced check-in)
    'OWNER_CLAIM',   -- Business owner stated · never conflated with independent verification
    'INFERRED',      -- Derived by NEX from other evidence · must show the derivation chain
    'UNKNOWN'        -- Absence-of-evidence · NEX honestly reports it doesn't know
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nex.bko_attribute_domain AS ENUM (
    'identity',              -- name · brand · operator · wikidata · alt names
    'location',              -- street · postcode · neighbourhood · lat/lng · in-target-zone
    'contact',               -- phone · whatsapp · email · website · social
    'opening_availability',  -- opening_hours · check_date · seasonal · reservation
    'facilities',            -- indoor/outdoor seating · capacity · rooms · wifi · parking
    'accessibility',         -- wheelchair · toilets:wheelchair · ramp · stairs
    'family',                -- changing_table · child_seats · kids_area
    'suitability',           -- dietary · alcohol · smoking (subject to Traveller Protection)
    'character',             -- cuisine · description · style · vibe (evidence only · never quality)
    'commercial',            -- payment methods · price range (raw values only · never derived rank)
    'freshness',             -- last-seen · check_date · superseded_by chain
    'physical'               -- building levels · height · structure
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS nex.business_knowledge (
  knowledge_id           uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic pointer (food or accommodation). Not a hard FK because the polymorphism
  -- is deliberate · vertical name recorded so BKO reader can join correctly.
  vertical               text                        NOT NULL CHECK (vertical IN ('food', 'accommodation')),
  business_ref           text                        NOT NULL,

  -- The SCIUD chain (per attribute · per source)
  attribute_domain       nex.bko_attribute_domain    NOT NULL,
  attribute_key          text                        NOT NULL,        -- e.g. 'wheelchair' · 'diet:vegetarian' · 'addr:street'
  source                 text                        NOT NULL,        -- 'osm_replay' · 'owner_form' · 'gov_registry' · 'website_scrape'
  source_reference       text                                          ,-- exact pointer within the source (osm node id · URL · form id)
  source_tier            nex.bko_source_tier         NOT NULL,
  claim                  jsonb                       NOT NULL,        -- the raw fact NEX may honestly cite
  interpretation         text                                          ,-- honest sentence NEX is allowed to say using this evidence
  unknown_note           text                                          ,-- what this evidence does NOT permit NEX to conclude
  confidence             numeric                                       ,-- 0.0 - 1.0 · optional · null = tier-implied
  captured_at            timestamptz                 NOT NULL DEFAULT now(),
  freshness_valid_until  timestamptz                                   ,-- null = no explicit expiry · reader may still degrade by age

  -- Provenance ledger (Truth Invariant · Direct-Provenance A)
  provenance             jsonb                       NOT NULL DEFAULT '{}'::jsonb,
  snapshot_id            uuid                                          ,-- FK-style reference to source_snapshot (not enforced · polymorphic)
  cycle_run_id           uuid                                          ,-- when discovered/refreshed by a Walker cycle

  -- Versioning (never rewrite · always supersede)
  superseded_by          uuid                                          ,-- self-reference to a newer knowledge_id
  created_at             timestamptz                 NOT NULL DEFAULT now(),

  -- Bounded uniqueness: one live row per (vertical, business, attribute, source, reference).
  -- New observations from the same source at a later time create a new row and the older
  -- row is marked superseded_by. Reader filters superseded_by IS NULL for current view.
  UNIQUE (vertical, business_ref, attribute_domain, attribute_key, source, source_reference)
);

CREATE INDEX IF NOT EXISTS idx_bko_business_lookup
  ON nex.business_knowledge (vertical, business_ref)
  WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_bko_domain_lookup
  ON nex.business_knowledge (vertical, attribute_domain, attribute_key)
  WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_bko_freshness
  ON nex.business_knowledge (freshness_valid_until)
  WHERE freshness_valid_until IS NOT NULL AND superseded_by IS NULL;

COMMENT ON TABLE nex.business_knowledge IS
  'Polymorphic evidence overlay. Each row = one piece of evidence about one attribute of one business. Rows carry SOURCE→CLAIM→INTERPRETATION→UNKNOWN. Never rewritten · superseded via superseded_by. Not read by any ranking scorer.';
COMMENT ON COLUMN nex.business_knowledge.source_tier IS
  'Immutable per row. VERIFIED = authoritative source. OBSERVED = machine observation. OWNER_CLAIM = owner-stated. INFERRED = NEX derivation (chain in provenance). UNKNOWN = absence-of-evidence.';
COMMENT ON COLUMN nex.business_knowledge.interpretation IS
  'The honest sentence NEX is ALLOWED to say using this specific evidence. Never invent a stronger claim.';
COMMENT ON COLUMN nex.business_knowledge.unknown_note IS
  'What this evidence does NOT permit NEX to conclude. Example: changing_table=yes permits "has a changing table" · does NOT permit "family safe".';

COMMIT;

-- Rollback (uncomment to apply):
-- BEGIN;
--   DROP TABLE IF EXISTS nex.business_knowledge;
--   DROP TYPE  IF EXISTS nex.bko_attribute_domain;
--   DROP TYPE  IF EXISTS nex.bko_source_tier;
-- COMMIT;
