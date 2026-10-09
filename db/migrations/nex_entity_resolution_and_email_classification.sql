-- NEX World Email Intelligence · Part 3 + Part 5 schema additions
-- Founder-authorised programme · bounded wave 2026-09-21.
--
-- ADDITIVE · idempotent · zero destructive change.
-- Governance invariants preserved:
--   * Entity states are explicit · never silently promoted
--   * Email classification is provider-agnostic · no whitelist
--   * DISCOVERED ≠ CLASSIFIED ≠ ELIGIBLE ≠ APPROVED-FOR-SEND

BEGIN;

-- ─── 1 · Entity resolution (Part 3) ──────────────────────────────
CREATE TABLE IF NOT EXISTS nex.discovery_entity (
  entity_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id        UUID NOT NULL REFERENCES nex.discovery_programme(programme_id) ON DELETE CASCADE,
  iso_alpha_2         CHAR(2) NOT NULL REFERENCES nex.world_country(iso_alpha_2) ON DELETE CASCADE,

  -- Canonical identity signals (each field is honestly optional · empty ≠ inferred)
  business_name       TEXT NOT NULL,
  business_name_norm  TEXT NOT NULL,                    -- lowercase · punctuation-stripped · used as identity key
  trading_name        TEXT,
  canonical_website   TEXT,                              -- normalized apex domain
  phone_norm          TEXT,                              -- E.164-ish · digits only
  address_line        TEXT,
  city                TEXT,
  region              TEXT,                              -- admin subdivision · not ISO 'region'
  postcode            TEXT,

  -- Lifecycle state (Part 3 mandate · 5 explicit states)
  state               TEXT NOT NULL DEFAULT 'candidate_entity'
                      CHECK (state IN ('unresolved','candidate_entity','resolved_entity','ambiguous_entity','rejected_entity')),
  state_reason        TEXT,

  -- Evidence accumulation
  category            TEXT,
  services            TEXT[] NOT NULL DEFAULT '{}',
  discovery_terms     TEXT[] NOT NULL DEFAULT '{}',
  source_urls         TEXT[] NOT NULL DEFAULT '{}',
  evidence_count      INTEGER NOT NULL DEFAULT 0,
  confidence          NUMERIC(4,3) NOT NULL DEFAULT 0.0
                      CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_cycle_id      UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  last_cycle_id       UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Identity uniqueness: one row per (programme, country, normalised-name, canonical-website)
  UNIQUE (programme_id, iso_alpha_2, business_name_norm, canonical_website)
);

CREATE INDEX IF NOT EXISTS ix_entity_by_country
  ON nex.discovery_entity (iso_alpha_2, programme_id, state);
CREATE INDEX IF NOT EXISTS ix_entity_by_domain
  ON nex.discovery_entity (canonical_website) WHERE canonical_website IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_entity_by_state
  ON nex.discovery_entity (programme_id, state, confidence DESC);

-- ─── 2 · Email classification columns (Part 5 partial schema) ────
-- Additive to discovery_business_evidence · never removes fields · never
-- changes semantics of existing rows. New columns are all nullable so
-- pre-existing rows remain valid.
ALTER TABLE nex.discovery_business_evidence
  ADD COLUMN IF NOT EXISTS email_type TEXT
      CHECK (email_type IN (
        'business_domain','free_provider','role_address','personal_looking','unknown'
      )),
  ADD COLUMN IF NOT EXISTS email_evidence_tier TEXT
      CHECK (email_evidence_tier IN (
        'directly_published_by_entity',
        'published_on_entity_website',
        'permitted_directory',
        'associated_with_resolved_entity',
        'weak_association',
        'unverified'
      )),
  ADD COLUMN IF NOT EXISTS email_provider_domain TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES nex.discovery_entity(entity_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_evidence_email_type
  ON nex.discovery_business_evidence (email_type)
  WHERE discovered_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_evidence_entity
  ON nex.discovery_business_evidence (entity_id) WHERE entity_id IS NOT NULL;

-- ─── 3 · Entity-source-URL provenance (many-to-many) ────────────
CREATE TABLE IF NOT EXISTS nex.discovery_entity_source (
  entity_id           UUID NOT NULL REFERENCES nex.discovery_entity(entity_id) ON DELETE CASCADE,
  source_url          TEXT NOT NULL,
  source_kind         TEXT NOT NULL,                    -- 'website' | 'directory' | 'listing' | 'search_result' | 'osm_element' | ...
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_id            UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (entity_id, source_url)
);

CREATE INDEX IF NOT EXISTS ix_entity_source_url ON nex.discovery_entity_source (source_url);

COMMIT;
