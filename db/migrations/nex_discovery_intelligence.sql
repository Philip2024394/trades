-- NEX Fresh World Discovery + Search Intelligence
-- Founder-authorised programme · bounded wave · 2026-09-21
--
-- Four durable tables · additive · idempotent · zero touch of any existing
-- accounting / lane / marketing_contact substrate.
--
-- GOVERNANCE HARD-LOCKS:
--   * discovery_search_term.status IN ('seed','candidate','validated','rejected')
--   * A term may never be silently promoted from 'candidate' to 'validated' ·
--     the transition is authored by Founder decision (checked in application code)
--   * discovery_relationship.evidence_count MUST be real observed counts ·
--     never fabricated
--   * SOURCE UNAVAILABLE is a distinct state from ZERO_RESULTS
--
-- These tables NEVER store email addresses. Discovery outputs land in the
-- existing nex_lab_*.harvest_raw upstream, and only the aggregate counts +
-- relationship evidence are recorded here.

BEGIN;

-- ─── 1 · Discovery cycle (5-minute snapshots · immutable append) ────
CREATE TABLE IF NOT EXISTS nex.discovery_cycle (
  cycle_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_seq           BIGINT NOT NULL,                       -- monotonic per-topic sequence
  topic               TEXT NOT NULL,                         -- e.g. 'scaffolding'
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at         TIMESTAMPTZ,
  duration_ms         INTEGER,

  -- What the cycle attempted
  searches_attempted  INTEGER NOT NULL DEFAULT 0,
  terms_used          TEXT[] NOT NULL DEFAULT '{}',
  countries_touched   TEXT[] NOT NULL DEFAULT '{}',
  sources_attempted   TEXT[] NOT NULL DEFAULT '{}',

  -- What the cycle observed (aggregate counts only · never addresses)
  businesses_discovered  INTEGER NOT NULL DEFAULT 0,
  new_emails             INTEGER NOT NULL DEFAULT 0,
  existing_matched       INTEGER NOT NULL DEFAULT 0,
  rejected_emails        INTEGER NOT NULL DEFAULT 0,
  newly_classified       INTEGER NOT NULL DEFAULT 0,
  newly_eligible         INTEGER NOT NULL DEFAULT 0,
  categories_touched     TEXT[] NOT NULL DEFAULT '{}',

  -- Per-source outcome breakdown as JSONB · array of {source, outcome, elements, note}
  source_outcomes     JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Overall outcome classification
  outcome             TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (outcome IN ('in_progress','complete','partial','zero_results','source_unavailable','failed')),
  note                TEXT,

  -- Governance flags
  sends_triggered     INTEGER NOT NULL DEFAULT 0,            -- MUST always be 0 in this wave
  addresses_exposed   INTEGER NOT NULL DEFAULT 0,            -- MUST always be 0

  CONSTRAINT ck_discovery_cycle_no_send      CHECK (sends_triggered = 0),
  CONSTRAINT ck_discovery_cycle_no_addresses CHECK (addresses_exposed = 0)
);

CREATE INDEX IF NOT EXISTS ix_discovery_cycle_topic_seq
  ON nex.discovery_cycle (topic, cycle_seq DESC);

CREATE INDEX IF NOT EXISTS ix_discovery_cycle_recent
  ON nex.discovery_cycle (started_at DESC);

-- ─── 2 · Search vocabulary term (seeds + candidates + validated + rejected) ─
CREATE TABLE IF NOT EXISTS nex.discovery_search_term (
  term_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term                TEXT NOT NULL,
  topic               TEXT NOT NULL,                         -- e.g. 'scaffolding'
  family              TEXT,                                  -- 'core' | 'trade' | 'equipment' | 'commercial' | 'industry_context'
  language            TEXT NOT NULL DEFAULT 'en',
  country_applicability TEXT[] NOT NULL DEFAULT ARRAY['all'],

  status              TEXT NOT NULL DEFAULT 'candidate'
                      CHECK (status IN ('seed','candidate','validated','rejected')),
  source              TEXT NOT NULL,                         -- 'founder-seed' | 'related-expansion' | 'observed-from-cycle:<uuid>' | 'founder-decision'
  primary_relationship TEXT,                                 -- e.g. 'self' | 'seed:scaffolding' | 'commercial_service_of:scaffolding'

  discovery_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_count      INTEGER NOT NULL DEFAULT 0,            -- real observed occurrences · never fabricated
  last_evidence_at    TIMESTAMPTZ,
  first_promoted_at   TIMESTAMPTZ,                           -- when moved seed → validated · or candidate → validated
  first_promoted_by   TEXT,                                  -- 'founder' · 'system:governance' (system never auto-promotes to validated)

  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (term, topic, language)
);

CREATE INDEX IF NOT EXISTS ix_search_term_topic_status
  ON nex.discovery_search_term (topic, status);

CREATE INDEX IF NOT EXISTS ix_search_term_evidence
  ON nex.discovery_search_term (topic, evidence_count DESC);

-- ─── 3 · Discovered relationships (evidence-backed · never inferred without evidence) ─
CREATE TABLE IF NOT EXISTS nex.discovery_relationship (
  relationship_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_term         TEXT NOT NULL,                         -- e.g. 'scaffolding'
  child_term          TEXT NOT NULL,                         -- e.g. 'scaffold hire'
  relationship_kind   TEXT NOT NULL,                         -- 'trade_of' | 'commercial_service_of' | 'equipment_of' | 'industry_context_of' | 'synonym_of'
  topic               TEXT NOT NULL,
  evidence_count      INTEGER NOT NULL DEFAULT 0,
  confidence          NUMERIC(4,3) NOT NULL DEFAULT 0.0
                      CHECK (confidence >= 0 AND confidence <= 1),
  first_observed_cycle UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  last_observed_cycle  UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  first_observed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  status              TEXT NOT NULL DEFAULT 'candidate'
                      CHECK (status IN ('candidate','validated','rejected','superseded')),

  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (parent_term, child_term, relationship_kind, topic)
);

CREATE INDEX IF NOT EXISTS ix_relationship_parent
  ON nex.discovery_relationship (parent_term, topic, evidence_count DESC);

CREATE INDEX IF NOT EXISTS ix_relationship_status
  ON nex.discovery_relationship (topic, status, evidence_count DESC);

-- ─── 4 · Per-source health (SOURCE UNAVAILABLE distinct from ZERO_RESULTS) ─
CREATE TABLE IF NOT EXISTS nex.discovery_source_health (
  source              TEXT PRIMARY KEY,                      -- e.g. 'https://overpass-api.de/api/interpreter'
  last_success_at     TIMESTAMPTZ,
  last_success_bytes  INTEGER,
  last_failure_at     TIMESTAMPTZ,
  last_failure_reason TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  breaker_open_until  TIMESTAMPTZ,
  requests_attempted  INTEGER NOT NULL DEFAULT 0,
  requests_succeeded  INTEGER NOT NULL DEFAULT 0,
  bytes_in_total      BIGINT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
