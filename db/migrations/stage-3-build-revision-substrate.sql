-- ============================================================================
-- Stage 3 of BUILD PLAN v1.1 · Build Snapshot + Revision Substrate
-- ============================================================================
--
-- Founder-authorised 2026-09-11 · continuous autonomous execution.
-- STATUS: AUTHORED · NOT YET APPLIED.
--
-- Consumes: ADR-0316c revision model + on-card change requests · ADR-0316b
-- 8-state lifecycle · ADR-0316a Security Agent · Section Safety Model
-- (three-level intervention · auto-rebuild lock).
--
-- Creates three PIPELINE substrates (never canonical Knowledge · never
-- queried by Router as truth · per ADR-0314i §9):
--
--   1. nex.build_artifact       — immutable content-hashed build snapshots
--   2. nex.section_revision     — per-CAP versioned revision history
--   3. nex.change_request       — founder-typed change requests on cards
--
-- Isolation guarantees identical to Stage 1a + Stage 1b:
--   - Zero FKs to specialist / knowledge_records / Supabase-mirror tables
--   - Zero mutation of existing production tables
--   - is_pipeline=true CHECK on every row
--   - authorisation_policy_ref remains null throughout Stage 3
--   - Rollback path: DROP TABLE (documented below · not executed)
--
-- ============================================================================

BEGIN;

-- Guardrail
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nex') THEN
    RAISE EXCEPTION 'nex schema not found. Production baseline required.';
  END IF;
END $$;

-- ============================================================================
-- 1 · nex.build_artifact · immutable content-hashed build snapshots
-- ============================================================================
-- Every NEX1 build produces exactly one artifact row per commit-worthy state.
-- Content hash is deterministic (sha256 of sorted file-list + normalized content).
-- Artifacts are NEVER updated · NEVER deleted (retention = forever).

CREATE TABLE IF NOT EXISTS nex.build_artifact (
  artifact_id                 uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash                text            NOT NULL UNIQUE,
  created_at                  timestamptz     NOT NULL DEFAULT now(),
  created_by_agent_id         text            NOT NULL,
  security_run_id             uuid            ,               -- loose reference to nex.security_growth_ledger.run_id
  files_included              jsonb           NOT NULL DEFAULT '[]'::jsonb,
  files_count                 integer         NOT NULL DEFAULT 0,
  total_bytes                 bigint          NOT NULL DEFAULT 0,
  tests_passed                integer         NOT NULL DEFAULT 0,
  tests_total                 integer         NOT NULL DEFAULT 0,
  guardian_verdict            text            ,               -- 'ACCEPT' | 'REJECT' | 'PENDING'
  truth_engine_ok             boolean         ,
  ui_dna_verdict              text            ,               -- 'PASS' | 'FAIL' | 'PENDING'
  notes                       text            ,
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT content_hash_not_empty CHECK (length(content_hash) > 0),
  CONSTRAINT agent_id_not_empty_ba CHECK (length(created_by_agent_id) > 0),
  CONSTRAINT tests_passed_bound CHECK (tests_passed >= 0 AND tests_passed <= tests_total)
);

-- Immutability trigger · UPDATE raises exception
CREATE OR REPLACE FUNCTION nex.raise_build_artifact_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'nex.build_artifact is immutable · UPDATE forbidden (ADR-0316c §4.2). '
                  'Every build produces a NEW artifact · never an update.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_build_artifact_immutable ON nex.build_artifact;
CREATE TRIGGER trg_build_artifact_immutable
  BEFORE UPDATE ON nex.build_artifact
  FOR EACH ROW EXECUTE FUNCTION nex.raise_build_artifact_immutable();

CREATE INDEX IF NOT EXISTS idx_build_artifact_hash
  ON nex.build_artifact (content_hash);

CREATE INDEX IF NOT EXISTS idx_build_artifact_agent
  ON nex.build_artifact (created_by_agent_id);

CREATE INDEX IF NOT EXISTS idx_build_artifact_at
  ON nex.build_artifact (created_at);

COMMENT ON TABLE nex.build_artifact IS
  'Stage 3 PIPELINE SUBSTRATE · NOT canonical Knowledge (ADR-0314i §9). '
  'Immutable content-hashed build snapshots · one per NEX1 build · retained forever. '
  'Referenced by nex.section_revision via artifact_id.';

-- ============================================================================
-- 2 · nex.section_revision · per-CAP versioned revision history
-- ============================================================================
-- One row per (capability, version) tuple. Parent-pointer walks history.
-- v1.0 → v1.1 → v1.2 → ... never overwrites (per ADR-0316c §4.1).
-- lifecycle_state tracks the 8-state card lifecycle from ADR-0316b §6.

CREATE TABLE IF NOT EXISTS nex.section_revision (
  revision_id                 uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id               text            NOT NULL,       -- e.g. 'CAP-091'
  version                     text            NOT NULL,       -- e.g. 'v1.0.0'
  parent_revision_id          uuid            REFERENCES nex.section_revision(revision_id),
  artifact_id                 uuid            NOT NULL REFERENCES nex.build_artifact(artifact_id),
  change_request_id           uuid            ,               -- FK to nex.change_request (added after that table exists)
  lifecycle_state             text            NOT NULL DEFAULT 'BUILDING',
  created_at                  timestamptz     NOT NULL DEFAULT now(),
  created_by_agent_id         text            NOT NULL,
  founder_approval_at         timestamptz     ,
  founder_signature           text            ,               -- session-signed token when Activate Live
  live_at                     timestamptz     ,               -- when it became ACTIVE
  reverted_at                 timestamptz     ,               -- when it left ACTIVE
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT section_revision_unique_version UNIQUE (capability_id, version),
  CONSTRAINT lifecycle_state_valid CHECK (lifecycle_state IN (
    'BUILDING',
    'TESTING',
    'AWAITING_PREVIEW',
    'IN_REVIEW',
    'REQUEST_UPDATE',
    'REJECTED',
    'APPROVED',
    'ACTIVATING',
    'ACTIVE',
    'REVERTED',
    'DISABLED'
  )),
  CONSTRAINT capability_id_pattern CHECK (capability_id ~ '^CAP-\d+$'),
  CONSTRAINT version_pattern CHECK (version ~ '^v\d+\.\d+\.\d+$'),
  CONSTRAINT agent_id_not_empty_sr CHECK (length(created_by_agent_id) > 0),
  CONSTRAINT no_self_parent CHECK (parent_revision_id IS NULL OR parent_revision_id <> revision_id)
);

CREATE INDEX IF NOT EXISTS idx_section_revision_cap
  ON nex.section_revision (capability_id);

CREATE INDEX IF NOT EXISTS idx_section_revision_state
  ON nex.section_revision (lifecycle_state);

CREATE INDEX IF NOT EXISTS idx_section_revision_parent
  ON nex.section_revision (parent_revision_id) WHERE parent_revision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_section_revision_artifact
  ON nex.section_revision (artifact_id);

COMMENT ON TABLE nex.section_revision IS
  'Stage 3 PIPELINE SUBSTRATE · NOT canonical Knowledge (ADR-0314i §9). '
  'One row per (capability_id, version). Parent pointer walks revision history. '
  'Never overwrites (per ADR-0316c §4.1). 11 lifecycle states from ADR-0316b §6 · '
  'plus DISABLED from three-level intervention feedback memory.';

-- ============================================================================
-- 3 · nex.change_request · founder-typed change requests on CAP cards
-- ============================================================================
-- Every founder change request creates a new row · triggers a new revision.
-- Attached images bind to change_request_id (never replace production DB assets).

CREATE TABLE IF NOT EXISTS nex.change_request (
  change_request_id           uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  target_capability_id        text            NOT NULL,
  target_revision_id          uuid            NOT NULL REFERENCES nex.section_revision(revision_id),
  founder_message             text            NOT NULL,
  attached_manifest_ids       text[]          NOT NULL DEFAULT '{}',
  submitted_at                timestamptz     NOT NULL DEFAULT now(),
  founder_signature           text            NOT NULL,       -- session-signed token
  spawned_revision_id         uuid            REFERENCES nex.section_revision(revision_id),  -- populated when NEX1 completes v1.N+1
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT founder_message_not_empty CHECK (length(founder_message) > 0),
  CONSTRAINT founder_signature_not_empty CHECK (length(founder_signature) > 0),
  CONSTRAINT target_capability_pattern CHECK (target_capability_id ~ '^CAP-\d+$')
);

CREATE INDEX IF NOT EXISTS idx_change_request_target_cap
  ON nex.change_request (target_capability_id);

CREATE INDEX IF NOT EXISTS idx_change_request_target_rev
  ON nex.change_request (target_revision_id);

CREATE INDEX IF NOT EXISTS idx_change_request_at
  ON nex.change_request (submitted_at);

COMMENT ON TABLE nex.change_request IS
  'Stage 3 PIPELINE SUBSTRATE · NOT canonical Knowledge (ADR-0314i §9). '
  'Founder-typed change requests submitted from Work Map CAP cards. '
  'Every request spawns a new revision (per ADR-0316c §4.1). Attached image manifest IDs '
  'bind to the change request · never replace production DB assets directly (ADR-0316c §5).';

-- Now add the deferred FK from section_revision to change_request
ALTER TABLE nex.section_revision
  ADD CONSTRAINT fk_section_revision_change_request
    FOREIGN KEY (change_request_id) REFERENCES nex.change_request(change_request_id);

-- ============================================================================
-- Isolation verification (fails apply if violated)
-- ============================================================================
DO $$
DECLARE
  fk_count integer;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'nex'
    AND tc.table_name IN ('build_artifact', 'section_revision', 'change_request')
    AND (
      ccu.table_schema <> 'nex' OR
      ccu.table_name NOT IN ('build_artifact', 'section_revision', 'change_request')
    );
  IF fk_count > 0 THEN
    RAISE EXCEPTION 'Section-build substrates have % FK(s) crossing to non-pipeline tables. Isolation violation.', fk_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- TEARDOWN (documented · not executed)
-- ============================================================================
--   BEGIN;
--     DROP TABLE IF EXISTS nex.change_request CASCADE;
--     DROP TABLE IF EXISTS nex.section_revision CASCADE;
--     DROP TABLE IF EXISTS nex.build_artifact CASCADE;
--     DROP TRIGGER IF EXISTS trg_build_artifact_immutable ON nex.build_artifact;
--     DROP FUNCTION IF EXISTS nex.raise_build_artifact_immutable();
--   COMMIT;
-- ============================================================================
