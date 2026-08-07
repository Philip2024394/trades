-- NEX Infrastructure Runtime · §5.4 extension · Contact Intelligence
--
-- Extends nex.contacts (existing snapshot table) with fields required by
-- the Single Contact Registry, plus three supporting tables for source
-- history, merge history, and duplicate-detection suggestions.
--
-- Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md
-- Idempotent · additive-only · safe to re-run.

-- ── nex.contacts field extensions ─────────────────────────────────
-- Every ADD COLUMN uses IF NOT EXISTS so re-running is safe.

ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS company             TEXT;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS country             TEXT;                    -- ISO 3166 alpha-2 preferred
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS region              TEXT;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS languages           JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS trade_categories    JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS preferred_channels  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS never_contact       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS unsubscribe_at      TIMESTAMPTZ;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS last_contacted_at   TIMESTAMPTZ;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS canonical_email     TEXT;                    -- normalized (lowercase · trim)
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS canonical_phone     TEXT;                    -- E.164 where determinable
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;             -- GDPR erasure marker (superseding snapshot)

-- Fast dedup lookups
CREATE INDEX IF NOT EXISTS contacts_canonical_email_idx ON nex.contacts (canonical_email) WHERE canonical_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_canonical_phone_idx ON nex.contacts (canonical_phone) WHERE canonical_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_country_idx         ON nex.contacts (country)          WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_never_contact_idx   ON nex.contacts (never_contact)    WHERE never_contact = TRUE;

-- ── nex.contact_sources · append-only source history ─────────────
-- One contact can be sourced from many places · every touchpoint gets a row.

CREATE TABLE IF NOT EXISTS nex.contact_sources (
  source_row_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        TEXT NOT NULL,
  source_type       TEXT NOT NULL,                                  -- "trades" · "newsletter" · "crm" · "form" · "manual" · "csv" · "api"
  source_ref        TEXT,                                            -- the identifier in the source system
  source_metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business_id       UUID
);

CREATE INDEX IF NOT EXISTS contact_sources_contact_idx    ON nex.contact_sources (contact_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS contact_sources_type_idx       ON nex.contact_sources (source_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS contact_sources_source_ref_idx ON nex.contact_sources (source_type, source_ref) WHERE source_ref IS NOT NULL;

-- ── nex.contact_merges · every merge event · reversal audit trail ──
-- absorbed_contact_id is aliased into surviving_contact_id from decided_at.

CREATE TABLE IF NOT EXISTS nex.contact_merges (
  merge_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surviving_contact_id    TEXT NOT NULL,
  absorbed_contact_id     TEXT NOT NULL,
  decided_by              TEXT,                                     -- admin actor
  decided_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rationale               TEXT,
  match_signals           JSONB NOT NULL DEFAULT '{}'::jsonb,       -- which heuristics matched (email · phone · name+company)
  reversed_at             TIMESTAMPTZ,
  reversed_by             TEXT
);

CREATE INDEX IF NOT EXISTS contact_merges_surviving_idx ON nex.contact_merges (surviving_contact_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS contact_merges_absorbed_idx  ON nex.contact_merges (absorbed_contact_id);

-- ── nex.contact_duplicate_suggestions · dedup queue ──────────────
-- Detected pairs awaiting admin decision. Auto-merge is never permitted.

CREATE TABLE IF NOT EXISTS nex.contact_duplicate_suggestions (
  suggestion_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_a         TEXT NOT NULL,
  contact_b         TEXT NOT NULL,
  match_kind        TEXT NOT NULL,                                  -- "email_exact" · "phone_exact" · "name_company_fuzzy"
  confidence        NUMERIC(5,2),                                    -- 0.00 .. 100.00
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at        TIMESTAMPTZ,
  decided_by        TEXT,
  decision          TEXT,                                            -- "merge" · "keep_separate" · "pending"
  merge_id          UUID REFERENCES nex.contact_merges(merge_id),
  CONSTRAINT contact_dup_ordered CHECK (contact_a < contact_b)      -- alphanumeric order · one pair per direction
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_dup_unique_pair_idx ON nex.contact_duplicate_suggestions (contact_a, contact_b, match_kind);
CREATE INDEX IF NOT EXISTS contact_dup_pending_idx           ON nex.contact_duplicate_suggestions (detected_at DESC) WHERE decision IS NULL OR decision = 'pending';

-- ── RLS policies (service_role only · admin surface) ─────────────
ALTER TABLE nex.contact_sources                ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.contact_merges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.contact_duplicate_suggestions  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'contact_sources' AND policyname = 'service_role_all_contact_sources') THEN
    CREATE POLICY "service_role_all_contact_sources" ON nex.contact_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'contact_merges' AND policyname = 'service_role_all_contact_merges') THEN
    CREATE POLICY "service_role_all_contact_merges" ON nex.contact_merges FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'contact_duplicate_suggestions' AND policyname = 'service_role_all_contact_dup') THEN
    CREATE POLICY "service_role_all_contact_dup" ON nex.contact_duplicate_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.contact_sources               IS 'Contact Intelligence · append-only source history';
COMMENT ON TABLE nex.contact_merges                IS 'Contact Intelligence · merge audit · absorbed → surviving';
COMMENT ON TABLE nex.contact_duplicate_suggestions IS 'Contact Intelligence · dedup queue · admin approves';
