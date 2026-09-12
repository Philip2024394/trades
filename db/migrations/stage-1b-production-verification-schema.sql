-- ============================================================================
-- Stage 1b · Sub-step 1b.1 · Production Verification Schema Migration
-- ============================================================================
--
-- Founder authorised sub-step 1b.1 · 2026-09-11 · verbatim:
--   "AUTHORISE STAGE 1b · SUB-STEP 1b.1 ONLY. Proceed with ONLY Stage 1b.1
--    from ADR-0314h, against the locked founder decisions in ADR-0314i.
--    Author 1b.1 only. Do NOT proceed to 1b.2 or any later sub-step."
--
-- STATUS: AUTHORED · NOT YET APPLIED
--   Master AI has authored this migration file per ADR-0314h §4.1-§4.4 +
--   §5 sub-step 1b.1 authoring instruction. Application to nex_dev
--   (production database) requires SEPARATE founder authorisation for
--   sub-step 1b.2. This file MUST NOT be applied by Master AI.
--
-- CONSUMED DOCTRINE (constitutional preconditions):
--   ADR-0314a.2.s Stage 1a Exit Report        · Stage 1a foundation preserved
--   ADR-0314f Guardian Responsibility Reconciliation  · three-way gate split
--   ADR-0314g NEX Acquisition Fabric Target Architecture · 9-object model
--   ADR-0314h Stage 1b Wiring bridge doctrine · §3 production-state model
--                                              · §4 substrate additions
--                                              · §5 sub-step 1b.1 spec
--   ADR-0314i Seven Stage 1b Founder Decisions · D-1b-1 through D-1b-7 +
--                                              §9 anti-competing-substrate
--
-- ============================================================================
-- LOCKED CONSTITUTIONAL INVARIANTS (enforced in-schema · CHECK constraints)
-- ============================================================================
--
--   1. NO PATH TO AUTHORITATIVE AT STAGE 1b
--      Every new table capable of representing verdict/state authorisation
--      carries `authorisation_policy_ref TEXT NULLABLE` with CHECK
--      `stage_1b_r10_blocked_check` enforcing `authorisation_policy_ref
--      IS NULL`. Stage 2 (R-10) will DROP this CHECK explicitly in its
--      own founder-authorised migration. Until then · no Claim reaches
--      AUTHORITATIVE via the constitutional pipeline (per ADR-0314h §3.1).
--
--   2. ANTI-COMPETING-KNOWLEDGE-SUBSTRATE INVARIANT (per ADR-0314i §9)
--      Every new table in this migration carries `is_pipeline BOOLEAN
--      NOT NULL DEFAULT true CHECK (is_pipeline = true)`. This makes it
--      structurally impossible for these tables to be conflated with
--      canonical Knowledge (specialist tables · nex.knowledge_records ·
--      Supabase knowledge). Table COMMENTs also declare "PIPELINE
--      SUBSTRATE · NOT CANONICAL KNOWLEDGE" for any future Router / query
--      surface review.
--
--   3. C-β LEGACY FREEZE (per ADR-0314i D-1b-1)
--      This migration does NOT modify any existing specialist table
--      (nex.accommodation_business · nex.food_business · etc.). It does
--      NOT add a `legacy_pre_constitutional` column (that was ADR-0314h
--      §4.5's option only if C-γ chosen · founder chose C-β · so no tag
--      column). Legacy AUTHORITATIVE writes will be frozen by the future
--      1b.4 production adapter · not by this schema migration.
--
--   4. FOREIGN KEY ISOLATION
--      All new tables reference ONLY new tables in this migration or
--      nothing at all. No FK from new pipeline tables to specialist
--      tables · knowledge_records · Supabase-mirror tables · Lab
--      substrates · or Stage 1a `nex_test.*` schema.
--
--   5. IMMUTABLE PROVENANCE
--      nex.evidence carries an immutability trigger. UPDATE on
--      nex.evidence raises an exception. Rows are append-only.
--
--   6. STATE ENUM CHECK
--      nex.claim_verification_state.current_state is CHECK-constrained
--      to the 10 states from ADR-0314h §3 (ACQUIRED · LAB_CANDIDATE_
--      REJECTED · LAB_CANDIDATE_ACCEPTED · VERIFIER_VERDICT_ISSUED ·
--      TE_GUARDIAN_REJECTED · TE_GUARDIAN_ACCEPTED · AWAITING_R10 ·
--      AUTHORITATIVE · CONTRADICTED · WITHDRAWN). A state-transition
--      CHECK enforces: current_state='AUTHORITATIVE' requires
--      authorisation_policy_ref IS NOT NULL. Combined with invariant
--      1 above · AUTHORITATIVE is unreachable at Stage 1b.
--
--   7. REJECTION CODE NAMESPACE
--      nex.te_guardian_rejection_event carries a CHECK enforcing
--      rejection_reason starts with 'te.' prefix (per ADR-0314f §5).
--      Lab-Guardian rejections do NOT live in this table · they live
--      in the existing preserved nex.gate_rejection_event with 'lab.'
--      prefix (per ADR-0314f preservation clause).
--
-- ============================================================================
-- IDEMPOTENCY
-- ============================================================================
--
--   All CREATE statements use IF NOT EXISTS. Migration may be re-applied
--   safely. If tables exist · they are preserved with their current data.
--
-- ============================================================================
-- TEARDOWN (documented · not executed by this migration)
-- ============================================================================
--
--   To remove this Stage 1b schema entirely without affecting anything else:
--
--     BEGIN;
--       DROP TABLE IF EXISTS nex.te_guardian_rejection_event CASCADE;
--       DROP TABLE IF EXISTS nex.te_guardian_kept_event CASCADE;
--       DROP TABLE IF EXISTS nex.reproducibility_run CASCADE;
--       DROP TABLE IF EXISTS nex.verifier_verdict CASCADE;
--       DROP TABLE IF EXISTS nex.claim_verification_state CASCADE;
--       DROP TABLE IF EXISTS nex.evidence CASCADE;
--       DROP TABLE IF EXISTS nex.claim CASCADE;
--       DROP TRIGGER IF EXISTS trg_evidence_immutable ON nex.evidence;
--       DROP FUNCTION IF EXISTS nex.raise_evidence_immutable();
--     COMMIT;
--
--   Preserves: Stage 1a foundation (nex_test.* untouched) · Lab-Guardian
--   ledger (nex.gate_kept_event + nex.gate_rejection_event preserved) ·
--   specialist tables · knowledge_records · Supabase · nex_lab_*.*.
--   Reversible. Founder-authored only. Master AI does NOT rollback.
--
-- ============================================================================
-- STAGE 2 UNLOCK PATH (documented · not executed)
-- ============================================================================
--
--   When Stage 2 (R-10) is founder-authorised · a separate migration
--   will drop the following two CHECK constraints to enable AUTHORITATIVE
--   promotion:
--
--     ALTER TABLE nex.verifier_verdict
--       DROP CONSTRAINT stage_1b_r10_blocked_check;
--     ALTER TABLE nex.claim_verification_state
--       DROP CONSTRAINT stage_1b_r10_blocked_check;
--
--   Until Stage 2 · these CHECKs enforce the R-10-absent safety boundary.
--
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Guardrail · this migration must run against a database where nex schema
-- exists AND stage-1a-nex-test-schema.sql was previously applied (Stage 1a
-- foundation must exist).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nex') THEN
    RAISE EXCEPTION 'nex schema not found. Production schema required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nex_test') THEN
    RAISE EXCEPTION 'nex_test schema not found. Stage 1a foundation must exist (apply stage-1a-nex-test-schema.sql first).';
  END IF;
END $$;

-- ============================================================================
-- 1 · nex.claim · Per-Claim row in the constitutional pipeline
-- ============================================================================
-- PIPELINE SUBSTRATE · NOT CANONICAL KNOWLEDGE (per ADR-0314i §9)
--   Every Claim is an attribute-assertion about an Entity under verification.
--   Claims never appear on any Router / query surface as truth. Canonical
--   Knowledge lives in specialist tables + nex.knowledge_records + Supabase.

CREATE TABLE IF NOT EXISTS nex.claim (
  claim_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_entity_ref          text            NOT NULL,       -- soft reference · Entity Resolution (Layer C4) fully resolves later per ADR-0314g
  attribute                   text            NOT NULL,       -- e.g. 'star_rating' · 'opening_hours' · 'rooms'
  value                       jsonb           NOT NULL,       -- polymorphic value payload
  unit                        text            ,               -- e.g. 'stars' · 'IDR/night' · null
  domain                      text            ,               -- one of 9 locked Domains per §7.10 M1 (optional at claim time · classifier fills)
  category                    text            ,               -- per R-12 taxonomy · pending founder authoring per ADR-0314a.2.k
  claim_source_id             text            ,               -- soft reference to Source Registry (Layer A · pending Phase C implementation)
  created_at                  timestamptz     NOT NULL DEFAULT now(),
  created_by                  text            NOT NULL,       -- worker/process that emitted the Claim
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT claim_subject_entity_ref_not_empty CHECK (length(subject_entity_ref) > 0),
  CONSTRAINT claim_attribute_not_empty CHECK (length(attribute) > 0)
);

CREATE INDEX IF NOT EXISTS idx_claim_subject_entity_ref
  ON nex.claim (subject_entity_ref);

CREATE INDEX IF NOT EXISTS idx_claim_attribute
  ON nex.claim (attribute);

CREATE INDEX IF NOT EXISTS idx_claim_domain
  ON nex.claim (domain) WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claim_created_at
  ON nex.claim (created_at);

COMMENT ON TABLE nex.claim IS
  'Stage 1b PIPELINE SUBSTRATE · NOT CANONICAL KNOWLEDGE (ADR-0314i §9). '
  'Per-Claim row in the constitutional pipeline. One row per attribute-'
  'assertion about an Entity under verification. Claims never appear on '
  'Router / query surface as truth. Router queries canonical Knowledge '
  'sources (specialist tables · nex.knowledge_records · Supabase) only.';

COMMENT ON COLUMN nex.claim.is_pipeline IS
  'Structural guarantee that this table cannot be conflated with canonical '
  'Knowledge. Anti-competing-substrate invariant per ADR-0314i §9.';

-- ============================================================================
-- 2 · nex.evidence · Per-Evidence row · immutable provenance trace
-- ============================================================================
-- PIPELINE PROVENANCE · NOT CANONICAL KNOWLEDGE (per ADR-0314i §9)
--   Evidence rows link a Claim backward to a Raw Capture from a Source
--   at a time. Immutable · append-only · trigger-enforced.

CREATE TABLE IF NOT EXISTS nex.evidence (
  evidence_id                 uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                    uuid            NOT NULL REFERENCES nex.claim(claim_id) ON DELETE CASCADE,
  source_id                   text            NOT NULL,       -- soft reference to Source Registry (pending Phase C)
  raw_capture_ref             text            ,               -- soft reference to Raw Capture Store (pending Phase C · Layer B5)
  extraction_method           text            NOT NULL,       -- 'structured-data' · 'semi-structured' · 'unstructured' · 'vision' · 'audio' · 'human-annotated'
  extraction_confidence       numeric(4, 3)   ,               -- 0.000-1.000 · extractor-reported · null if not measurable
  source_timestamp            timestamptz     ,               -- when the Source produced the underlying data (if known)
  recorded_at                 timestamptz     NOT NULL DEFAULT now(),
  provenance_licence          text            ,               -- source's licence terms (per ADR-0022 · ADR-0023)
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT evidence_source_id_not_empty CHECK (length(source_id) > 0),
  CONSTRAINT evidence_extraction_method_valid CHECK (extraction_method IN (
    'structured-data', 'semi-structured', 'unstructured',
    'vision', 'audio', 'human-annotated', 'api-response',
    'document', 'feed', 'conversation'
  )),
  CONSTRAINT evidence_confidence_range CHECK (
    extraction_confidence IS NULL OR (extraction_confidence >= 0 AND extraction_confidence <= 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_evidence_claim_id
  ON nex.evidence (claim_id);

CREATE INDEX IF NOT EXISTS idx_evidence_source_id
  ON nex.evidence (source_id);

CREATE INDEX IF NOT EXISTS idx_evidence_recorded_at
  ON nex.evidence (recorded_at);

COMMENT ON TABLE nex.evidence IS
  'Stage 1b PIPELINE PROVENANCE · NOT CANONICAL KNOWLEDGE (ADR-0314i §9). '
  'Immutable trace linking Claim → Raw Capture → Source. Append-only ('
  'trigger-enforced). Evidence rows never appear on Router / query surface '
  'as truth. Evidence supports "where did this fact come from?" queries · '
  'answered by walking backward from canonical Knowledge.';

-- Immutability trigger · UPDATE on nex.evidence raises exception
CREATE OR REPLACE FUNCTION nex.raise_evidence_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'nex.evidence is immutable · UPDATE forbidden (ADR-0314i §9). '
                  'Provenance rows are append-only. If a Claim needs new '
                  'Evidence · INSERT a new evidence row referencing the same claim_id.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidence_immutable ON nex.evidence;
CREATE TRIGGER trg_evidence_immutable
  BEFORE UPDATE ON nex.evidence
  FOR EACH ROW EXECUTE FUNCTION nex.raise_evidence_immutable();

-- ============================================================================
-- 3 · nex.reproducibility_run · Production determinism proof runs
-- ============================================================================
-- PIPELINE SUBSTRATE (per ADR-0314i §9 · production analog of Stage 1a
--   nex_test.reproducibility_run). Records each determinism-proof invocation
--   per ADR-0314i D-1b-7 (mandatory pre-release + continuous canary).

CREATE TABLE IF NOT EXISTS nex.reproducibility_run (
  reproducibility_run_id      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_instance_id        uuid            NOT NULL,
  rule_set_version            text            NOT NULL,
  guardian_version            text            NOT NULL,
  run_started_at              timestamptz     NOT NULL DEFAULT now(),
  run_completed_at            timestamptz     ,
  run_status                  text            NOT NULL DEFAULT 'in_progress'
                                              CHECK (run_status IN ('in_progress','completed','failed','aborted','divergence_detected')),
  run_purpose                 text            NOT NULL         -- 'pre_release' · 'continuous_canary' · 'audit_replay' · 'founder_requested'
                                              CHECK (run_purpose IN ('pre_release','continuous_canary','audit_replay','founder_requested')),
  fixtures_evaluated          integer         NOT NULL DEFAULT 0,
  fixtures_matched_expected   integer         NOT NULL DEFAULT 0,
  fixtures_diverged           integer         NOT NULL DEFAULT 0,
  determinism_report          jsonb           ,
  path_halted_on_failure      boolean         NOT NULL DEFAULT false,  -- per D-1b-7 · failure STOPS the relevant constitutional path
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  notes                       text
);

CREATE INDEX IF NOT EXISTS idx_reproducibility_run_status
  ON nex.reproducibility_run (run_status);

CREATE INDEX IF NOT EXISTS idx_reproducibility_run_purpose
  ON nex.reproducibility_run (run_purpose);

CREATE INDEX IF NOT EXISTS idx_reproducibility_run_started
  ON nex.reproducibility_run (run_started_at);

COMMENT ON TABLE nex.reproducibility_run IS
  'Stage 1b PIPELINE SUBSTRATE · production determinism proof ledger. '
  'Per ADR-0314i D-1b-7: mandatory pre-release verification + continuous '
  'canary checks. Determinism failure (path_halted_on_failure=true) STOPS '
  'the relevant constitutional path · does NOT silently continue.';

-- ============================================================================
-- 4 · nex.verifier_verdict · Production VerdictEnvelope per Claim
-- ============================================================================
-- PIPELINE VERDICT · NOT CANONICAL KNOWLEDGE (per ADR-0314i §9)
--   Production analog of Stage 1a nex_test.verifier_verdict. Records the
--   R-18 envelope produced by the Truth Engine per Claim.

CREATE TABLE IF NOT EXISTS nex.verifier_verdict (
  verdict_id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                    uuid            NOT NULL REFERENCES nex.claim(claim_id) ON DELETE CASCADE,
  verifier_instance_id        uuid            NOT NULL,
  rule_set_version            text            NOT NULL,
  guardian_version            text            NOT NULL,
  authorisation_policy_ref    text            ,               -- MUST BE NULL AT STAGE 1b · Stage 2 R-10 relaxes this constraint
  truth_engine_ok             boolean         NOT NULL,       -- aggregate integrity boolean · NOT promotion to AUTHORITATIVE
  per_rule_verdicts           jsonb           NOT NULL DEFAULT '{}'::jsonb,
  object_snapshot_ref         text            NOT NULL,       -- per R-18 envelope · references Claim's subject_entity_ref
  evidence_refs               text[]          NOT NULL DEFAULT '{}',
  reproducibility_run_id      uuid            REFERENCES nex.reproducibility_run(reproducibility_run_id),
  verdict_at                  timestamptz     NOT NULL DEFAULT now(),
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  -- STAGE 1b R-10-ABSENT SAFETY BOUNDARY (ADR-0314h §3.1 · ADR-0314i D-1b-1)
  -- Stage 2 migration will DROP this CHECK when R-10 is founder-authorised.
  CONSTRAINT stage_1b_r10_blocked_check CHECK (authorisation_policy_ref IS NULL),
  CONSTRAINT verifier_verdict_object_snapshot_not_empty CHECK (length(object_snapshot_ref) > 0)
);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_claim
  ON nex.verifier_verdict (claim_id);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_run
  ON nex.verifier_verdict (reproducibility_run_id) WHERE reproducibility_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_instance
  ON nex.verifier_verdict (verifier_instance_id);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_at
  ON nex.verifier_verdict (verdict_at);

CREATE INDEX IF NOT EXISTS idx_verifier_verdict_truth_engine_ok
  ON nex.verifier_verdict (truth_engine_ok);

COMMENT ON TABLE nex.verifier_verdict IS
  'Stage 1b PIPELINE VERDICT · NOT CANONICAL KNOWLEDGE (ADR-0314i §9). '
  'Per-Claim R-18 envelope from the Truth Engine. truth_engine_ok is an '
  'aggregate integrity boolean · NOT a promotion signal. authorisation_'
  'policy_ref MUST be NULL at Stage 1b (stage_1b_r10_blocked_check). '
  'Stage 2 R-10 will drop that CHECK in a separate founder-authorised '
  'migration when R-10 policies are authored.';

COMMENT ON CONSTRAINT stage_1b_r10_blocked_check ON nex.verifier_verdict IS
  'Stage 1b R-10-absent safety boundary. No Claim reaches AUTHORITATIVE '
  'via the constitutional pipeline until Stage 2 (R-10) is founder-'
  'authorised. Stage 2 migration will DROP this CHECK explicitly.';

-- ============================================================================
-- 5 · nex.claim_verification_state · Per-Claim state machine tracking
-- ============================================================================
-- PIPELINE STATE · NOT CANONICAL KNOWLEDGE (per ADR-0314i §9)
--   Tracks each Claim's current state through the 10 states from ADR-0314h §3.
--   One state row per Claim (UNIQUE on claim_id).

CREATE TABLE IF NOT EXISTS nex.claim_verification_state (
  state_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                    uuid            NOT NULL UNIQUE REFERENCES nex.claim(claim_id) ON DELETE CASCADE,
  current_state               text            NOT NULL,       -- 10 states per ADR-0314h §3
  authorisation_policy_ref    text            ,               -- MUST BE NULL AT STAGE 1b · Stage 2 R-10 relaxes
  last_transition_at          timestamptz     NOT NULL DEFAULT now(),
  last_transition_from        text            ,               -- previous state · null on initial ACQUIRED
  last_transition_reason      text            ,               -- for REJECTED states · the canonical fail-closed reason
  latest_verdict_id           uuid            REFERENCES nex.verifier_verdict(verdict_id),
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT claim_verification_state_current_state_valid CHECK (
    current_state IN (
      'ACQUIRED',
      'LAB_CANDIDATE_REJECTED',
      'LAB_CANDIDATE_ACCEPTED',
      'VERIFIER_VERDICT_ISSUED',
      'TE_GUARDIAN_REJECTED',
      'TE_GUARDIAN_ACCEPTED',
      'AWAITING_R10',
      'AUTHORITATIVE',
      'CONTRADICTED',
      'WITHDRAWN'
    )
  ),
  -- STAGE 1b R-10-ABSENT SAFETY BOUNDARY (ADR-0314h §3.1)
  -- No claim_verification_state row may carry a non-null authorisation_policy_ref
  -- until Stage 2 · this CHECK is dropped by the Stage 2 migration.
  CONSTRAINT stage_1b_r10_blocked_check CHECK (authorisation_policy_ref IS NULL),
  -- AUTHORITATIVE STATE REQUIRES R-10 POLICY REFERENCE (structural invariant · survives Stage 2 relax)
  -- Combined with stage_1b_r10_blocked_check above · AUTHORITATIVE is unreachable at Stage 1b.
  -- After Stage 2 drops stage_1b_r10_blocked_check · this CHECK still requires
  -- authorisation_policy_ref to be non-null for AUTHORITATIVE state.
  CONSTRAINT authoritative_requires_r10_policy CHECK (
    current_state <> 'AUTHORITATIVE' OR authorisation_policy_ref IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_claim_verification_state_current
  ON nex.claim_verification_state (current_state);

CREATE INDEX IF NOT EXISTS idx_claim_verification_state_transition_at
  ON nex.claim_verification_state (last_transition_at);

CREATE INDEX IF NOT EXISTS idx_claim_verification_state_verdict
  ON nex.claim_verification_state (latest_verdict_id) WHERE latest_verdict_id IS NOT NULL;

COMMENT ON TABLE nex.claim_verification_state IS
  'Stage 1b PIPELINE STATE · NOT CANONICAL KNOWLEDGE (ADR-0314i §9). '
  'One state row per Claim. 10 states per ADR-0314h §3. Terminal state '
  'at Stage 1b is AWAITING_R10 (per R-10-absent safety boundary). '
  'AUTHORITATIVE unreachable until Stage 2 R-10 authors policies.';

COMMENT ON CONSTRAINT authoritative_requires_r10_policy ON nex.claim_verification_state IS
  'Structural invariant surviving Stage 2 relax: even after R-10 exists · '
  'a state row cannot claim AUTHORITATIVE without a specific R-10 policy '
  'reference. Prevents ungoverned AUTHORITATIVE writes forever.';

-- ============================================================================
-- 6 · nex.te_guardian_kept_event · Production TE-Guardian ACCEPT ledger
-- ============================================================================
-- DISTINCT FROM Lab-Guardian ledger (nex.gate_kept_event · preserved per
-- ADR-0314f). TE-Guardian and Lab-Guardian have distinct responsibilities
-- (per ADR-0314f §3) · distinct ledgers prevent audit confusion.

CREATE TABLE IF NOT EXISTS nex.te_guardian_kept_event (
  event_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  verdict_id                  uuid            NOT NULL REFERENCES nex.verifier_verdict(verdict_id) ON DELETE CASCADE,
  claim_id                    uuid            NOT NULL REFERENCES nex.claim(claim_id) ON DELETE CASCADE,
  guardian_version            text            NOT NULL,
  verifier_instance_id        uuid            NOT NULL,
  rule_set_version            text            NOT NULL,
  event_at                    timestamptz     NOT NULL DEFAULT now(),
  event_payload               jsonb           NOT NULL DEFAULT '{}'::jsonb,
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true)
);

CREATE INDEX IF NOT EXISTS idx_te_guardian_kept_event_verdict
  ON nex.te_guardian_kept_event (verdict_id);

CREATE INDEX IF NOT EXISTS idx_te_guardian_kept_event_claim
  ON nex.te_guardian_kept_event (claim_id);

CREATE INDEX IF NOT EXISTS idx_te_guardian_kept_event_at
  ON nex.te_guardian_kept_event (event_at);

COMMENT ON TABLE nex.te_guardian_kept_event IS
  'Stage 1b PIPELINE SUBSTRATE · TE-Guardian ACCEPT ledger. DISTINCT from '
  'nex.gate_kept_event (Lab-Guardian ledger · preserved per ADR-0314f). '
  'ACCEPT means: envelope is constitutionally sound. DOES NOT mean AUTHORITATIVE '
  'promotion (only R-10 authorises · Stage 2 territory).';

-- ============================================================================
-- 7 · nex.te_guardian_rejection_event · Production TE-Guardian REJECT ledger
-- ============================================================================
-- DISTINCT FROM Lab-Guardian rejection ledger (nex.gate_rejection_event ·
-- preserved · uses 'lab.' prefix per ADR-0314f §5). TE-Guardian rejections
-- use 'te.' prefix and live here.

CREATE TABLE IF NOT EXISTS nex.te_guardian_rejection_event (
  event_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  verdict_id                  uuid            REFERENCES nex.verifier_verdict(verdict_id) ON DELETE CASCADE,
  claim_id                    uuid            REFERENCES nex.claim(claim_id) ON DELETE CASCADE,
  guardian_version            text            NOT NULL,
  rejection_reason            text            NOT NULL,       -- canonical 'te.' prefix per ADR-0314f §5
  rejection_codes             text[]          NOT NULL DEFAULT '{}',
  event_at                    timestamptz     NOT NULL DEFAULT now(),
  event_payload               jsonb           NOT NULL DEFAULT '{}'::jsonb,
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT te_guardian_rejection_reason_prefix CHECK (rejection_reason LIKE 'te.%'),
  CONSTRAINT te_guardian_rejection_codes_prefix CHECK (
    rejection_codes = ARRAY[]::text[] OR
    NOT EXISTS (
      SELECT 1 FROM unnest(rejection_codes) AS c
      WHERE c NOT LIKE 'te.%'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_te_guardian_rejection_event_verdict
  ON nex.te_guardian_rejection_event (verdict_id) WHERE verdict_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_te_guardian_rejection_event_claim
  ON nex.te_guardian_rejection_event (claim_id) WHERE claim_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_te_guardian_rejection_event_reason
  ON nex.te_guardian_rejection_event (rejection_reason);

CREATE INDEX IF NOT EXISTS idx_te_guardian_rejection_event_at
  ON nex.te_guardian_rejection_event (event_at);

COMMENT ON TABLE nex.te_guardian_rejection_event IS
  'Stage 1b PIPELINE SUBSTRATE · TE-Guardian REJECT ledger. DISTINCT from '
  'nex.gate_rejection_event (Lab-Guardian ledger · lab. prefix). TE-Guardian '
  'rejections use te. prefix per ADR-0314f §5. Rejected envelopes discarded · '
  'never proceed to R-10 · never become AUTHORITATIVE.';

COMMENT ON CONSTRAINT te_guardian_rejection_reason_prefix ON nex.te_guardian_rejection_event IS
  'Rejection namespace discipline per ADR-0314f §5: TE-Guardian codes '
  'MUST use te. prefix. Prevents cross-Guardian rule confusion.';

-- ============================================================================
-- Isolation verification (informational · runs inside this transaction)
-- ============================================================================
-- Verify no FK from new tables to specialist tables · knowledge_records ·
-- Supabase-mirror tables · Lab substrates · or nex_test.*.

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
    AND tc.table_name IN (
      'claim', 'evidence', 'reproducibility_run', 'verifier_verdict',
      'claim_verification_state', 'te_guardian_kept_event', 'te_guardian_rejection_event'
    )
    AND (
      ccu.table_schema <> 'nex' OR
      ccu.table_name NOT IN (
        'claim', 'evidence', 'reproducibility_run', 'verifier_verdict',
        'claim_verification_state', 'te_guardian_kept_event', 'te_guardian_rejection_event'
      )
    );
  IF fk_count > 0 THEN
    RAISE EXCEPTION 'Stage 1b pipeline substrates have % foreign key(s) crossing to non-pipeline tables. Isolation violation.', fk_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (informational · run after apply)
-- ============================================================================
--
-- 1. Verify all 7 new tables created:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'nex'
--      AND table_name IN (
--        'claim', 'evidence', 'reproducibility_run', 'verifier_verdict',
--        'claim_verification_state', 'te_guardian_kept_event',
--        'te_guardian_rejection_event'
--      )
--    ORDER BY table_name;
--    Expected: 7 rows
--
-- 2. Verify authorisation_policy_ref CHECK on nex.verifier_verdict:
--    SELECT constraint_name FROM information_schema.check_constraints
--    WHERE constraint_schema = 'nex'
--      AND constraint_name = 'stage_1b_r10_blocked_check';
--    Expected: constraint exists on nex.verifier_verdict AND nex.claim_verification_state
--
-- 3. Verify authorisation_policy_ref CHECK prevents non-null writes:
--    -- This INSERT should FAIL:
--    -- INSERT INTO nex.verifier_verdict (claim_id, verifier_instance_id, rule_set_version, guardian_version, authorisation_policy_ref, truth_engine_ok, object_snapshot_ref)
--    -- VALUES (gen_random_uuid(), gen_random_uuid(), 'test', 'test', 'r10.smuggled', true, 'test');
--
-- 4. Verify AUTHORITATIVE state unreachable at Stage 1b:
--    -- This INSERT should FAIL (both stage_1b_r10_blocked_check AND authoritative_requires_r10_policy fire):
--    -- INSERT INTO nex.claim_verification_state (claim_id, current_state, authorisation_policy_ref)
--    -- VALUES (some_claim_id, 'AUTHORITATIVE', NULL);
--
-- 5. Verify evidence immutability trigger:
--    -- This UPDATE should raise exception:
--    -- UPDATE nex.evidence SET extraction_method = 'changed' WHERE evidence_id = some_evidence_id;
--
-- 6. Verify rejection code prefix on nex.te_guardian_rejection_event:
--    -- This INSERT should FAIL:
--    -- INSERT INTO nex.te_guardian_rejection_event (guardian_version, rejection_reason)
--    -- VALUES ('test', 'lab.wrong_prefix');
--
-- 7. Verify no cross-schema FKs to specialist tables:
--    SELECT tc.table_schema, tc.table_name, kcu.column_name,
--           ccu.table_schema AS foreign_schema, ccu.table_name AS foreign_table
--    FROM information_schema.table_constraints tc
--    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
--    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
--    WHERE tc.constraint_type = 'FOREIGN KEY'
--      AND tc.table_schema = 'nex'
--      AND tc.table_name IN (
--        'claim', 'evidence', 'reproducibility_run', 'verifier_verdict',
--        'claim_verification_state', 'te_guardian_kept_event', 'te_guardian_rejection_event'
--      )
--      AND (ccu.table_schema <> 'nex'
--           OR ccu.table_name NOT IN (
--             'claim', 'evidence', 'reproducibility_run', 'verifier_verdict',
--             'claim_verification_state', 'te_guardian_kept_event', 'te_guardian_rejection_event'
--           ));
--    Expected: 0 rows
--
-- 8. Verify existing production tables unchanged (spot-check):
--    SELECT COUNT(*) FROM nex.accommodation_business;  -- expect unchanged from baseline
--    SELECT COUNT(*) FROM nex.food_business;           -- expect unchanged
--    SELECT COUNT(*) FROM nex.gate_kept_event;         -- expect 2,300 (Lab-Guardian ledger preserved)
--    SELECT COUNT(*) FROM nex.gate_rejection_event;    -- expect 368 (Lab-Guardian ledger preserved)
--    SELECT COUNT(*) FROM nex.knowledge_records;       -- expect unchanged
--
-- 9. Verify Stage 1a nex_test.* untouched:
--    SELECT COUNT(*) FROM nex_test.fixture_row;        -- expect 33
--    SELECT COUNT(*) FROM nex_test.fixture_expected;   -- expect 33
--    SELECT COUNT(*) FROM nex_test.verifier_verdict;   -- expect 150 (from 1a.7)
--    SELECT COUNT(*) FROM nex_test.reproducibility_run;-- expect 5 (from 1a.7)
--
-- 10. Verify all new tables carry is_pipeline=true default and CHECK:
--     SELECT table_name, column_name, column_default
--     FROM information_schema.columns
--     WHERE table_schema = 'nex' AND column_name = 'is_pipeline'
--       AND table_name IN (
--         'claim', 'evidence', 'reproducibility_run', 'verifier_verdict',
--         'claim_verification_state', 'te_guardian_kept_event', 'te_guardian_rejection_event'
--       );
--     Expected: 7 rows · all with column_default='true'
--
-- ============================================================================
-- END OF MIGRATION FILE · Stage 1b Sub-step 1b.1
-- ============================================================================
--
-- Sub-step 1b.1 status: AUTHORED
-- Sub-step 1b.2 (APPLY) status: BLOCKED pending separate founder authorisation
--
-- Master AI does NOT apply this migration. Founder authorises 1b.2 separately
-- after reviewing this file · at which point a human/operator runs the SQL.
--
-- ============================================================================
