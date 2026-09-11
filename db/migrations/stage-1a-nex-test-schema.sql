-- ============================================================================
-- Stage 1a · nex_test.* isolated schema migration
-- ============================================================================
--
-- Founder authorised sub-step 1a.1 · 2026-09-11 · verbatim:
--   "AUTHORISE SUB-STEP 1a.1 ONLY. Author the nex_test.* schema migration file
--    exactly within the locked Stage 1a scope. Do not apply it. Do not create
--    the schema. Do not modify production or any existing substrate. Do not
--    write fixtures. Do not write verifier code yet."
--
-- STATUS: AUTHORED · NOT YET APPLIED
--   Master AI has authored this migration file. Application to nex_dev
--   requires separate founder authorisation (sub-step 1a.2). Founder reviews
--   the file · authorises the apply · then a human/operator runs the SQL.
--   Master AI does NOT run this migration.
--
-- SCOPE: Stage 1a smallest-certified-path per D-Impl lock (ADR-0314e)
--   Purpose: create an isolated `nex_test` schema for verifier + Guardian
--   fixture-based testing. Verifier proves 100% deterministic parity against
--   ADR-0314a.1 reference fixture set BEFORE any production substrate write.
--
-- CONSUMED DOCTRINE:
--   R-11.v1.0.0 (confidence · ADR-0314a.2.j · D-11 lock: 6-band + unknown)
--   R-17.v1.0.0 (versioning · ADR-0314a.2.m · D-17 lock: 30% Levenshtein initial)
--   R-18.v1.0.0 (verifier envelope · verifier_instance_id + rule_set_version)
--   R-20.v1.0.0 (contradiction · ADR-0314a.2.r · structure locked)
--   R-01.v1.0.0 (plausibility · ADR-0314a.2.n · D-01-values 14 thresholds locked)
--   ADR-0314e (verifier · Gate 3 CANDIDATE · doctrine locked)
--   ADR-0314a.1 (Fixture Set · D-Fix lock: 33 baseline · 50-75 target)
--   §7.7 H1 (`other` ≠ `unknown` · axis-specific)
--   §7.6.5 G4 (Activity ≠ Domain · R-07 unknown ≠ false ≠ contradiction)
--
-- ============================================================================
-- ISOLATION GUARANTEES (per founder Pre-Flight Item 1 + 1a.1 authorisation)
-- ============================================================================
--
--   1. Schema `nex_test` is entirely SEPARATE from `nex.*` production schema
--   2. NO foreign key from nex_test.* → nex.* (or any other production schema)
--   3. NO trigger on nex.* tables installed by this migration
--   4. NO alteration of any existing nex.* table
--   5. NO production data copied by this migration
--   6. Fixture data (when populated in sub-step 1a.6) will carry `is_fixture=true`
--   7. Verdicts (when populated in sub-step 1a.8) live only in `nex_test.verifier_verdict`
--   8. NO mechanism in this schema promotes any row to AUTHORITATIVE status
--   9. Teardown path: `DROP SCHEMA nex_test CASCADE` removes ALL fixture and
--      verdict state · nex.* production remains untouched · reversible
--
--   The verifier code (authored in sub-step 1a.3+) reads production nex.*
--   only via SELECT for fixture-parity checks · never writes.
--
-- ============================================================================
-- DEPENDENCIES
-- ============================================================================
--
--   Postgres extensions: assumes `pgcrypto` or `uuid-ossp` for gen_random_uuid()
--   (already available in nex_dev per existing migrations 001+).
--   No other schema dependencies. No dependency on nex_lab_*.*
--
-- ============================================================================
-- IDEMPOTENCY
-- ============================================================================
--
--   All CREATE statements use IF NOT EXISTS. Migration may be re-applied safely.
--   If nex_test schema already exists, existing tables are preserved.
--
-- ============================================================================
-- TEARDOWN (documented · not executed)
-- ============================================================================
--
--   To remove this schema entirely without affecting production:
--     BEGIN;
--       DROP SCHEMA IF EXISTS nex_test CASCADE;
--     COMMIT;
--
--   This removes: all nex_test.* tables · all fixture rows · all verdict rows ·
--   all test Guardian events. Production nex.* is untouched.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS nex_test;

COMMENT ON SCHEMA nex_test IS
  'Stage 1a isolated schema · Truth Engine + Guardian fixture testing · '
  'ADR-0314e doctrine · ADR-0314a.1 fixture set · founder-authorised '
  '2026-09-11 · production nex.* untouched · teardown: DROP SCHEMA nex_test CASCADE';

-- ---------------------------------------------------------------------------
-- Fixture rows · ADR-0314a.1 · Reference Fixture Set
-- ---------------------------------------------------------------------------
-- Contains the 33 baseline + additional cross-rule fixtures per D-Fix.
-- Fixture rows are AUTHORED by founder in sub-step 1a.6 (NOT by this migration).
-- This migration only creates the empty tables · fixture population is a
-- separate founder-authorised step.

CREATE TABLE IF NOT EXISTS nex_test.fixture_row (
  fixture_id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_set_version         text            NOT NULL,       -- e.g. 'fixture_set.v1.0.0'
  r_rule                      text            NOT NULL,       -- R-01 · R-03 · R-05 · R-07 · R-11 · R-12 · R-13 · R-17 · R-18 · R-20 · cross_substrate
  fixture_purpose             text            NOT NULL,       -- 'positive' | 'negative' | 'fail_closed_unknown' | 'cross_rule' | 'edge_case'
  input_row_shape             jsonb           NOT NULL,       -- canonical row shape being tested
  domain                      text            ,               -- optional · one of 9 locked Domains where applicable
  cross_rule_interactions     text[]          NOT NULL DEFAULT '{}',  -- which other R-rules this fixture also exercises
  is_fixture                  boolean         NOT NULL DEFAULT true CHECK (is_fixture = true),
  founder_authored            boolean         NOT NULL DEFAULT false,
  founder_authored_at         timestamptz     ,
  authored_by                 text            ,
  created_at                  timestamptz     NOT NULL DEFAULT now(),
  notes                       text
);

CREATE INDEX IF NOT EXISTS idx_fixture_row_r_rule
  ON nex_test.fixture_row (r_rule);

CREATE INDEX IF NOT EXISTS idx_fixture_row_set_version
  ON nex_test.fixture_row (fixture_set_version);

COMMENT ON TABLE nex_test.fixture_row IS
  'ADR-0314a.1 reference fixture rows · isolated from production · is_fixture=true enforced';

-- ---------------------------------------------------------------------------
-- Fixture expected outcomes · deterministic reproducibility requirement
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_test.fixture_expected (
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  r_rule                      text            NOT NULL,
  expected_verdict            text            NOT NULL,       -- 'PASS' | 'REJECT' | 'UNKNOWN' | 'CANDIDATE_FLAG' | 'CONTRADICTION_RECORDED'
  expected_reason             text            ,               -- named fail-closed reason per §7.7 H1
  expected_confidence_band    text            ,               -- 'very_high' | 'high' | 'good' | 'moderate' | 'low' | 'very_low' | 'unknown'
  expected_threshold_version  text            ,               -- e.g. plausibility_threshold.v1.0.0 · confidence_band_derivation.v1.0.0
  expected_authored_at        timestamptz     ,
  authored_by                 text            ,
  PRIMARY KEY (fixture_id, r_rule)
);

COMMENT ON TABLE nex_test.fixture_expected IS
  'Expected verdict per fixture per R-rule · deterministic reproducibility check';

-- ---------------------------------------------------------------------------
-- Verifier verdicts · ADR-0314e Section 4 envelope
-- ---------------------------------------------------------------------------
-- Mirrors the eventual production nex.verifier_verdict shape · but lives
-- entirely inside nex_test · never touches production.
-- Verdicts recorded here are TEST verdicts only · no promotion mechanism.

CREATE TABLE IF NOT EXISTS nex_test.verifier_verdict (
  verdict_id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  verifier_instance_id        uuid            NOT NULL,       -- per R-18 · deterministic per verifier deploy
  rule_set_version            text            NOT NULL,       -- composed manifest per ADR-0314a rule-parity
  guardian_version            text            NOT NULL,
  authorisation_policy_ref    text            ,               -- null at Stage 1a · Stage 2 R-10 gate fills this
  truth_engine_ok             boolean         NOT NULL,       -- aggregate verdict · NOT promotion to AUTHORITATIVE
  per_rule_verdicts           jsonb           NOT NULL DEFAULT '{}'::jsonb,  -- R-01..R-20 individual verdicts
  reproducibility_run_id      uuid            NOT NULL,       -- links repeat runs of the same fixture
  verdict_at                  timestamptz     NOT NULL DEFAULT now(),
  is_test_verdict             boolean         NOT NULL DEFAULT true CHECK (is_test_verdict = true),
  notes                       text
);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_fixture
  ON nex_test.verifier_verdict (fixture_id);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_run
  ON nex_test.verifier_verdict (reproducibility_run_id);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_instance
  ON nex_test.verifier_verdict (verifier_instance_id);

COMMENT ON TABLE nex_test.verifier_verdict IS
  'Test verdicts from Stage 1a verifier · isolated from production · '
  'is_test_verdict=true enforced · no AUTHORITATIVE promotion mechanism · '
  'R-18 envelope per ADR-0314e Section 4';

-- ---------------------------------------------------------------------------
-- Reproducibility runs · verifies deterministic (same input → same output)
-- ---------------------------------------------------------------------------
-- Sub-step 1a.9 requires proving reproducibility across 3-5 runs.
-- Each run records its identifier + timestamp + verifier instance.
-- Correlation of verdicts across runs proves determinism per fixture.

CREATE TABLE IF NOT EXISTS nex_test.reproducibility_run (
  reproducibility_run_id      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_set_version         text            NOT NULL,
  verifier_instance_id        uuid            NOT NULL,
  rule_set_version            text            NOT NULL,
  run_started_at              timestamptz     NOT NULL DEFAULT now(),
  run_completed_at            timestamptz     ,
  run_status                  text            NOT NULL DEFAULT 'in_progress'
                                              CHECK (run_status IN ('in_progress','completed','failed','aborted')),
  fixtures_evaluated          integer         NOT NULL DEFAULT 0,
  fixtures_matched_expected   integer         NOT NULL DEFAULT 0,
  fixtures_diverged           integer         NOT NULL DEFAULT 0,
  determinism_report          jsonb           ,               -- summarises match/divergence per fixture
  notes                       text
);

CREATE INDEX IF NOT EXISTS idx_reproducibility_run_status
  ON nex_test.reproducibility_run (run_status);

COMMENT ON TABLE nex_test.reproducibility_run IS
  'Sub-step 1a.9 reproducibility run tracking · determinism report per run';

-- ---------------------------------------------------------------------------
-- Guardian permit events (test) · mirrors nex.gate_kept_event shape
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_test.gate_kept_event (
  event_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  guardian_rule               text            NOT NULL,       -- e.g. 'R-01_plausibility' · 'R-11_band_derivation' · 'R-12_classification'
  guardian_version            text            NOT NULL,
  event_at                    timestamptz     NOT NULL DEFAULT now(),
  event_payload               jsonb           NOT NULL DEFAULT '{}'::jsonb,
  is_test_event               boolean         NOT NULL DEFAULT true CHECK (is_test_event = true)
);

CREATE INDEX IF NOT EXISTS idx_gate_kept_event_fixture
  ON nex_test.gate_kept_event (fixture_id);

CREATE INDEX IF NOT EXISTS idx_gate_kept_event_rule
  ON nex_test.gate_kept_event (guardian_rule);

COMMENT ON TABLE nex_test.gate_kept_event IS
  'Guardian permit events during fixture testing · isolated · never touches '
  'production nex.gate_kept_event';

-- ---------------------------------------------------------------------------
-- Guardian rejection events (test) · mirrors nex.gate_rejection_event shape
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_test.gate_rejection_event (
  event_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  guardian_rule               text            NOT NULL,
  guardian_version            text            NOT NULL,
  rejection_reason            text            NOT NULL,       -- named fail-closed reason string per §7.7 H1
  event_at                    timestamptz     NOT NULL DEFAULT now(),
  event_payload               jsonb           NOT NULL DEFAULT '{}'::jsonb,
  is_test_event               boolean         NOT NULL DEFAULT true CHECK (is_test_event = true)
);

CREATE INDEX IF NOT EXISTS idx_gate_rejection_event_fixture
  ON nex_test.gate_rejection_event (fixture_id);

CREATE INDEX IF NOT EXISTS idx_gate_rejection_event_rule
  ON nex_test.gate_rejection_event (guardian_rule);

CREATE INDEX IF NOT EXISTS idx_gate_rejection_event_reason
  ON nex_test.gate_rejection_event (rejection_reason);

COMMENT ON TABLE nex_test.gate_rejection_event IS
  'Guardian rejection events during fixture testing · isolated · fail-closed '
  'reason strings preserved per §7.7 H1';

-- ---------------------------------------------------------------------------
-- R-11 confidence score records (test) · per ADR-0314a.2.j D-11 6+unknown bands
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_test.confidence_score (
  confidence_id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  numeric_score               integer         ,               -- 0-100 · nullable for `unknown` band per §7.7 H1
  derived_band                text            NOT NULL,       -- 'very_high' | 'high' | 'good' | 'moderate' | 'low' | 'very_low' | 'unknown'
  confidence_band_derivation_version text     NOT NULL DEFAULT 'confidence_band_derivation.v1.0.0',
  recorded_at                 timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT score_range CHECK (numeric_score IS NULL OR (numeric_score >= 0 AND numeric_score <= 100)),
  CONSTRAINT band_null_score_only_unknown CHECK (
    (numeric_score IS NULL AND derived_band = 'unknown') OR
    (numeric_score IS NOT NULL AND derived_band <> 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS idx_confidence_score_fixture
  ON nex_test.confidence_score (fixture_id);

COMMENT ON TABLE nex_test.confidence_score IS
  'R-11 confidence scores during fixture testing · 6-band + unknown per D-11 · '
  'null score requires derived_band = unknown per §7.7 H1';

-- ---------------------------------------------------------------------------
-- R-17 record versions (test) · per ADR-0314a.2.m D-17 30% Levenshtein
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_test.record_version (
  version_id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  version_number              integer         NOT NULL,
  previous_version_id         uuid            REFERENCES nex_test.record_version(version_id),
  trigger_reason              text            NOT NULL,       -- 'body_diff_30pct' · 'claim_delta' · 'authority_change' · 'status_transition' · 'domain_reclassification' · 'founder_declared'
  versioning_threshold_version text           NOT NULL DEFAULT 'versioning_threshold.v1.0.0-initial',
  change_summary              text            ,
  changed_by                  text            NOT NULL,
  changed_at                  timestamptz     NOT NULL DEFAULT now(),
  content_snapshot            jsonb           NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_record_version_fixture
  ON nex_test.record_version (fixture_id);

CREATE INDEX IF NOT EXISTS idx_record_version_trigger
  ON nex_test.record_version (trigger_reason);

COMMENT ON TABLE nex_test.record_version IS
  'R-17 record versions during fixture testing · triggers per D-17 lock';

-- ---------------------------------------------------------------------------
-- R-20 contradictions (test) · per ADR-0314a.2.r deterministic rules only
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_test.contradiction (
  contradiction_id            uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id                  uuid            NOT NULL REFERENCES nex_test.fixture_row(fixture_id) ON DELETE CASCADE,
  subject_ref                 text            ,               -- bridge-mediated subject identifier
  attribute                   text            NOT NULL,
  rule_category               text            NOT NULL,       -- '1_incompatible_claims' | '2_numeric_outside_tolerance' | '3_authority_disagreement' | '4_unauthorised_regression'
  contradiction_rules_version text            NOT NULL DEFAULT 'contradiction_rules.v1.0.0',
  detected_at                 timestamptz     NOT NULL DEFAULT now(),
  evidence_payload            jsonb           NOT NULL DEFAULT '{}'::jsonb,
  is_test_contradiction       boolean         NOT NULL DEFAULT true CHECK (is_test_contradiction = true)
);

CREATE INDEX IF NOT EXISTS idx_contradiction_fixture
  ON nex_test.contradiction (fixture_id);

CREATE INDEX IF NOT EXISTS idx_contradiction_subject
  ON nex_test.contradiction (subject_ref) WHERE subject_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contradiction_category
  ON nex_test.contradiction (rule_category);

COMMENT ON TABLE nex_test.contradiction IS
  'R-20 contradictions detected during fixture testing · deterministic rules '
  'only per ADR-0314a.2.r · FORBIDDEN bases (similarity/keyword/LLM-alone/'
  'missing-data/scope-mismatch) never produce entries here';

-- ---------------------------------------------------------------------------
-- Isolation constraint: schema-level check
-- ---------------------------------------------------------------------------
-- No table in this migration references any production nex.* table.
-- No trigger installed by this migration touches any production table.
-- No view in this schema exposes production data.
-- Manual verification: grep this file for 'REFERENCES nex\.' or 'nex\.' outside
-- of comments · should return zero results.

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (informational · run after apply)
-- ============================================================================
--
-- Verify schema created:
--   SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'nex_test';
--
-- Verify all 8 tables:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'nex_test' ORDER BY table_name;
--   Expected: fixture_row · fixture_expected · verifier_verdict · reproducibility_run ·
--             gate_kept_event · gate_rejection_event · confidence_score · record_version · contradiction (9 tables)
--
-- Verify no foreign keys to production:
--   SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS foreign_schema, ccu.table_name AS foreign_table
--   FROM information_schema.table_constraints tc
--   JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
--   JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
--   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'nex_test' AND ccu.table_schema <> 'nex_test';
--   Expected: 0 rows (all FKs stay within nex_test)
--
-- Verify no triggers on production tables installed by this migration:
--   SELECT event_object_schema, event_object_table, trigger_name FROM information_schema.triggers WHERE event_object_schema = 'nex';
--   Expected: existing production triggers only · no new entries from this migration
--
-- ============================================================================
-- END OF MIGRATION FILE
-- ============================================================================
