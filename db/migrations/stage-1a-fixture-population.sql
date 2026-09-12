-- ============================================================================
-- Stage 1a · Fixture Population · 33 baseline fixtures
-- ============================================================================
--
-- Founder authorised sub-step 1a.6 · 2026-09-11:
--   "AUTHORISE SUB-STEP 1a.6 ONLY. Populate the 33 baseline fixtures defined
--    by ADR-0314a.1 into nex_test.*. This is an isolated test-data write
--    only. ... Populate exactly the ADR-0314a.1 baseline fixture set.
--    Every fixture must ... have founder_authored = true only because these
--    are the founder-approved baseline fixtures. ... Do not expand the
--    fixture set beyond the approved 33 during this sub-step."
--
-- SCOPE:
--   - Writes exclusively to nex_test.fixture_row and nex_test.fixture_expected
--   - Zero writes to nex.* production schema
--   - Zero writes to nex_lab_* schemas
--   - Zero AUTHORITATIVE promotion · zero R-10 authorisation
--   - Idempotent: uses INSERT ... ON CONFLICT DO NOTHING for stable re-runs
--   - Deterministic UUIDs: fixture_id encodes rule_seq + purpose_seq for
--     traceability and reproducibility across re-populations
--
-- FIXTURE MATRIX (ADR-0314a.1 Section 3):
--   R-01  plausibility    · positive · negative · fail_closed_unknown
--   R-03  voice           · positive · negative · fail_closed_unknown
--   R-05  authority       · positive · negative · fail_closed_unknown
--   R-07  connection      · positive · negative · fail_closed_unknown
--   R-11  confidence      · positive · negative · fail_closed_unknown
--   R-12  classification  · positive · negative · fail_closed_unknown
--   R-13  relationship    · positive · negative · fail_closed_unknown
--   R-17  versioning      · positive · negative · fail_closed_unknown
--   R-18  verifier ident. · positive · negative · fail_closed_unknown
--   R-20  contradiction   · positive · negative · fail_closed_unknown
--   cross_substrate       · positive · negative · fail_closed_unknown
--
--   Total: 11 rules × 3 fixtures = 33 baseline fixtures
--   (R-02 audience + R-10 promotion are deferred to Stage 3 / Stage 2 per
--    ADR-0314a.1 Section 3 · not in this population.)
--
-- IMPORTANT DOCTRINE:
--   Expected verdicts encode the ADR-0314a.1 matrix — the intended
--   Stage-1a-exit semantics. Rules whose founder-authored policy is
--   still PENDING (R-03 · R-05 · R-07 · R-12 · R-20) will produce UNKNOWN
--   at all fixtures today. That is intentional and preserved in the
--   fail_closed_unknown fixture expectations. The positive/negative
--   fixtures for pending rules record the intended semantics for when
--   founder authors the policy values in later ADRs.
--
-- DETERMINISTIC UUID SCHEME:
--   f1RRPPnn-0000-4000-8000-000000000000
--     RR = rule sequence (01=R-01 · 02=R-03 · 03=R-05 · 04=R-07 · 05=R-11
--                          06=R-12 · 07=R-13 · 08=R-17 · 09=R-18 · 10=R-20
--                          11=cross_substrate)
--     PP = purpose (01=positive · 02=negative · 03=fail_closed_unknown)
--     nn = intra-fixture index (00 for single fixture per cell)
--
-- ============================================================================

BEGIN;

-- Guardrail: this file MUST run against a database where nex_test schema
-- exists. If it doesn't, raise a clean error.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nex_test') THEN
    RAISE EXCEPTION 'nex_test schema not found. Apply stage-1a-nex-test-schema.sql (sub-step 1a.2) first.';
  END IF;
END $$;

-- ============================================================================
-- FIXTURE ROWS
-- ============================================================================

INSERT INTO nex_test.fixture_row
  (fixture_id, fixture_set_version, r_rule, fixture_purpose, input_row_shape,
   domain, cross_rule_interactions, is_fixture, founder_authored,
   founder_authored_at, authored_by, notes)
VALUES

-- ----- R-01 · plausibility (ADR-0314a.2.n · 14 founder-authored thresholds) -----

  ('f1010100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-01', 'positive',
   '{"plausibility":{"domain":"accommodation","attribute":"star_rating","value":4}}'::jsonb,
   'accommodation', ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-01 positive: hotel star_rating=4 → PASS'),

  ('f1010200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-01', 'negative',
   '{"plausibility":{"domain":"accommodation","attribute":"star_rating","value":47}}'::jsonb,
   'accommodation', ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-01 negative: star_rating=47 → REJECT plausibility_check_failed'),

  ('f1010300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-01', 'fail_closed_unknown',
   '{"plausibility":{"domain":"unauthored_domain","attribute":"star_rating","value":4}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-01 fail-closed: unauthored Domain threshold → UNKNOWN plausibility_check_disabled_pending_thresholds'),

-- ----- R-03 · voice (ADR-0317 · policy PENDING) -----

  ('f1020100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-03', 'positive',
   '{"voice":{"text":"Rule-compliant NEX voice output","channel":"chat"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-03 positive: rule-compliant → PASS (aspirational · rule pending mandate authoring)'),

  ('f1020200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-03', 'negative',
   '{"voice":{"text":"Contains banned voice phrasing","channel":"chat","hasBannedTerm":true}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-03 negative: banned-word → REJECT voice_check_failed (aspirational · rule pending)'),

  ('f1020300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-03', 'fail_closed_unknown',
   '{"voice":{"text":"Any input while mandate is pending","channel":"chat"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-03 fail-closed: unauthored mandate → UNKNOWN voice_check_disabled_pending_mandate (current-state)'),

-- ----- R-05 · authority (ADR-0314a.2.p · registry PENDING) -----

  ('f1030100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-05', 'positive',
   '{"authority":{"source":"registered.authority.example","registered":true}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-05 positive: registered authority → PASS (aspirational · registry pending)'),

  ('f1030200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-05', 'negative',
   '{"authority":{"source":"unregistered.source.example","registered":false}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-05 negative: unregistered → REJECT unregistered_authority (aspirational)'),

  ('f1030300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-05', 'fail_closed_unknown',
   '{"authority":{"source":"any.source","registered":false}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-05 fail-closed: unauthored registry → UNKNOWN authority_check_disabled_pending_registry (current-state)'),

-- ----- R-07 · connection plausibility (ADR-0314a.2.q · criteria PENDING) -----

  ('f1040100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-07', 'positive',
   '{"connection":{"endpointA":"concept:hotel","endpointB":"concept:accommodation","relation":"hypernym","evidence":["evidence:seed-1"]}}'::jsonb,
   NULL, ARRAY['R-13','R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-07 positive: valid endpoints + relation + evidence → PASS (aspirational)'),

  ('f1040200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-07', 'negative',
   '{"connection":{"endpointA":null,"endpointB":"concept:accommodation","relation":"hypernym"}}'::jsonb,
   NULL, ARRAY['R-13','R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-07 negative: missing endpoint → CANDIDATE_FLAG (not FAIL — no-evidence ≠ implausibility)'),

  ('f1040300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-07', 'fail_closed_unknown',
   '{"connection":{"endpointA":"concept:x","endpointB":"concept:y","relation":"related"}}'::jsonb,
   NULL, ARRAY['R-13','R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-07 fail-closed: unauthored criteria → UNKNOWN plausibility_check_disabled_pending_criteria — NEVER false NEVER contradiction'),

-- ----- R-11 · confidence (ADR-0314a.2.j · D-11 6-band + unknown) -----

  ('f1050100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-11', 'positive',
   '{"confidence":{"numericScore":85,"declaredBand":"good"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-11 positive: score=85 · band=good → PASS'),

  ('f1050200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-11', 'negative',
   '{"confidence":{"numericScore":85,"declaredBand":"very_high"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-11 negative: score=85 · band=very_high → REJECT band_drift_detected (G-2 non-bypass)'),

  ('f1050300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-11', 'fail_closed_unknown',
   '{"confidence":{"numericScore":null}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-11 fail-closed: score=null → band=unknown · Guardian rejects promotion (never converts to very_low)'),

-- ----- R-12 · classification (ADR-0314a.2.k · per-Domain enums PENDING) -----

  ('f1060100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-12', 'positive',
   '{"classification":{"value":"any_registered_enum_value_when_taxonomy_authored"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-12 positive: registered value → PASS (aspirational · enums pending)'),

  ('f1060200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-12', 'negative',
   '{"classification":{"value":"unregistered_value_forever_forbidden"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-12 negative: unregistered → REJECT unregistered_classification_value (aspirational)'),

  ('f1060300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-12', 'fail_closed_unknown',
   '{"classification":{"value":"any_value_while_taxonomy_pending"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-12 fail-closed: unauthored taxonomy → UNKNOWN classification_taxonomy_version=pending (current-state)'),

-- ----- R-13 · relationship vocabulary (ADR-0314a.2.l · 8-value baseline) -----

  ('f1070100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-13', 'positive',
   '{"relationship":{"relationKind":"hypernym"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-13 positive: registered relation_kind hypernym → PASS'),

  ('f1070200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-13', 'negative',
   '{"relationship":{"relationKind":"invented_relation_kind"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-13 negative: unregistered → REJECT unregistered_relation_kind'),

  ('f1070300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-13', 'fail_closed_unknown',
   '{"relationship":{"relationKind":null}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-13 fail-closed: unauthored vocabulary extension → UNKNOWN relationship_vocabulary_version=pending'),

-- ----- R-17 · versioning (ADR-0314a.2.m · D-17 30% Levenshtein) -----

  ('f1080100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-17', 'positive',
   '{"versioning":{"oldBody":"The quick brown fox jumps over the lazy dog","newBody":"Completely different wording rewritten from scratch beyond threshold","claimDelta":false}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-17 positive: significant change > 30% Levenshtein → version created'),

  ('f1080200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-17', 'negative',
   '{"versioning":{"oldBody":"The quick brown fox","newBody":"The quick brown fox","claimDelta":false}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-17 negative: non-significant change → no version'),

  ('f1080300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-17', 'fail_closed_unknown',
   '{"versioning":{"oldBody":"identical","newBody":"identical","founderDeclaredSignificance":true}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-17 fail-closed: founder-declared override → always creates version regardless of Levenshtein'),

-- ----- R-18 · verifier identity (ADR-0314e · envelope audit) -----

  ('f1090100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-18', 'positive',
   '{"envelope":{"complete":true,"objectSnapshotRef":"fixture-r18-pos-ref","evidenceRefs":["ev-1"]}}'::jsonb,
   NULL, ARRAY[]::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-18 positive: complete envelope → PASS'),

  ('f1090200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-18', 'negative',
   '{"envelope":{"objectSnapshotRef":"","evidenceRefs":["ev-1"]}}'::jsonb,
   NULL, ARRAY[]::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-18 negative: missing verifier_instance_id (encoded here as empty objectSnapshotRef) → REJECT missing_verifier_instance_id'),

  ('f1090300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-18', 'fail_closed_unknown',
   '{"envelope":{"objectSnapshotRef":"fx","evidenceRefs":null}}'::jsonb,
   NULL, ARRAY[]::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-18 fail-closed: missing rule_set_version / evidenceRefs → REJECT missing_rule_set_version'),

-- ----- R-20 · contradiction (ADR-0314a.2.r · per-attribute rules PENDING) -----

  ('f1100100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-20', 'positive',
   '{"contradiction":{"delta":"none","subject":"concept:test"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-20 positive: no contradiction → PASS (aspirational · rules pending)'),

  ('f1100200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-20', 'negative',
   '{"contradiction":{"delta":"deterministic_incompatible_claim","subject":"concept:test","authoredRule":"1_incompatible_claims"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-20 negative: deterministic contradiction → RECORD (aspirational · rules pending)'),

  ('f1100300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'R-20', 'fail_closed_unknown',
   '{"contradiction":{"delta":"wording difference or missing information or scope difference","subject":"concept:test"}}'::jsonb,
   NULL, ARRAY['R-18']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 R-20 fail-closed: unauthored rules · wording/missing/scope → UNKNOWN cross_record_detection_pending_rules — NEVER contradiction'),

-- ----- cross_substrate (ADR-0314c · bridge-mediated) -----

  ('f1110100-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'cross_substrate', 'positive',
   '{"crossSubstrate":{"subjectRef":"bridge:hotel-abc","substrateA":"nex.knowledge_records","substrateB":"nex.bridge_records","agreement":true}}'::jsonb,
   NULL, ARRAY['R-18','R-20']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 cross-substrate positive: same-subject agreement across substrates → PASS'),

  ('f1110200-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'cross_substrate', 'negative',
   '{"crossSubstrate":{"subjectRef":"bridge:hotel-abc","substrateA":"nex.knowledge_records","substrateB":"nex.bridge_records","agreement":false,"authoredRule":"1_incompatible_claims"}}'::jsonb,
   NULL, ARRAY['R-18','R-20']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 cross-substrate negative: same-subject contradiction (via authored rule) → RECORD'),

  ('f1110300-0000-4000-8000-000000000000', 'fixture_set.v1.0.0', 'cross_substrate', 'fail_closed_unknown',
   '{"crossSubstrate":{"subjectRef":null,"substrateA":"nex.knowledge_records","substrateB":"nex.bridge_records"}}'::jsonb,
   NULL, ARRAY['R-18','R-20']::text[], true, true, '2026-09-11T00:00:00Z', 'Philip',
   'ADR-0314a.1 §3 cross-substrate fail-closed: bridge unresolvable → UNKNOWN bridge_unresolvable')

ON CONFLICT (fixture_id) DO NOTHING;

-- ============================================================================
-- FIXTURE EXPECTED VERDICTS
-- ============================================================================
-- One expected row per (fixture_id, r_rule) pair. Encodes ADR-0314a.1 §3
-- matrix verdicts verbatim.

INSERT INTO nex_test.fixture_expected
  (fixture_id, r_rule, expected_verdict, expected_reason,
   expected_confidence_band, expected_threshold_version,
   expected_authored_at, authored_by)
VALUES

-- ----- R-01 · plausibility -----
  ('f1010100-0000-4000-8000-000000000000', 'R-01', 'PASS',
   NULL, NULL, 'plausibility_threshold.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1010200-0000-4000-8000-000000000000', 'R-01', 'REJECT',
   'plausibility_check_failed', NULL, 'plausibility_threshold.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1010300-0000-4000-8000-000000000000', 'R-01', 'UNKNOWN',
   'plausibility_check_disabled_pending_thresholds', NULL, 'plausibility_threshold.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-03 · voice -----
  ('f1020100-0000-4000-8000-000000000000', 'R-03', 'PASS',
   NULL, NULL, 'voice_mandate.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1020200-0000-4000-8000-000000000000', 'R-03', 'REJECT',
   'voice_check_failed', NULL, 'voice_mandate.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1020300-0000-4000-8000-000000000000', 'R-03', 'UNKNOWN',
   'voice_check_disabled_pending_mandate', NULL, 'voice_mandate.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-05 · authority -----
  ('f1030100-0000-4000-8000-000000000000', 'R-05', 'PASS',
   NULL, NULL, 'external_authority_registry.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1030200-0000-4000-8000-000000000000', 'R-05', 'REJECT',
   'unregistered_authority', NULL, 'external_authority_registry.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1030300-0000-4000-8000-000000000000', 'R-05', 'UNKNOWN',
   'authority_check_disabled_pending_registry', NULL, 'external_authority_registry.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-07 · connection · never `false` · never `contradiction` -----
  ('f1040100-0000-4000-8000-000000000000', 'R-07', 'PASS',
   NULL, NULL, 'connection_criteria.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1040200-0000-4000-8000-000000000000', 'R-07', 'CANDIDATE_FLAG',
   NULL, NULL, 'connection_criteria.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1040300-0000-4000-8000-000000000000', 'R-07', 'UNKNOWN',
   'plausibility_check_disabled_pending_criteria', NULL, 'connection_criteria.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-11 · confidence + band derivation -----
  ('f1050100-0000-4000-8000-000000000000', 'R-11', 'PASS',
   NULL, 'good', 'confidence_band_derivation.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1050200-0000-4000-8000-000000000000', 'R-11', 'REJECT',
   'band_drift_detected', 'good', 'confidence_band_derivation.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1050300-0000-4000-8000-000000000000', 'R-11', 'UNKNOWN',
   'unknown_score_cannot_promote', 'unknown', 'confidence_band_derivation.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-12 · classification -----
  ('f1060100-0000-4000-8000-000000000000', 'R-12', 'PASS',
   NULL, NULL, 'classification_taxonomy.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1060200-0000-4000-8000-000000000000', 'R-12', 'REJECT',
   'unregistered_classification_value', NULL, 'classification_taxonomy.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1060300-0000-4000-8000-000000000000', 'R-12', 'UNKNOWN',
   'classification_taxonomy_version=pending', NULL, 'classification_taxonomy.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-13 · relationship -----
  ('f1070100-0000-4000-8000-000000000000', 'R-13', 'PASS',
   NULL, NULL, 'relationship_vocabulary.v1.0.0-baseline', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1070200-0000-4000-8000-000000000000', 'R-13', 'REJECT',
   'unregistered_relation_kind', NULL, 'relationship_vocabulary.v1.0.0-baseline', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1070300-0000-4000-8000-000000000000', 'R-13', 'UNKNOWN',
   'relationship_vocabulary_version=pending', NULL, 'relationship_vocabulary.v1.0.0-baseline', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-17 · versioning -----
  ('f1080100-0000-4000-8000-000000000000', 'R-17', 'PASS',
   NULL, NULL, 'versioning_threshold.v1.0.0-initial', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1080200-0000-4000-8000-000000000000', 'R-17', 'PASS',
   NULL, NULL, 'versioning_threshold.v1.0.0-initial', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1080300-0000-4000-8000-000000000000', 'R-17', 'PASS',
   NULL, NULL, 'versioning_threshold.v1.0.0-initial', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-18 · verifier identity -----
  ('f1090100-0000-4000-8000-000000000000', 'R-18', 'PASS',
   NULL, NULL, NULL, '2026-09-11T00:00:00Z', 'Philip'),
  ('f1090200-0000-4000-8000-000000000000', 'R-18', 'REJECT',
   'missing_verifier_instance_id', NULL, NULL, '2026-09-11T00:00:00Z', 'Philip'),
  ('f1090300-0000-4000-8000-000000000000', 'R-18', 'REJECT',
   'missing_rule_set_version', NULL, NULL, '2026-09-11T00:00:00Z', 'Philip'),

-- ----- R-20 · contradiction · never `contradiction` when unauthored -----
  ('f1100100-0000-4000-8000-000000000000', 'R-20', 'PASS',
   NULL, NULL, 'contradiction_rules.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1100200-0000-4000-8000-000000000000', 'R-20', 'CONTRADICTION_RECORDED',
   'cross_record_detection_deterministic', NULL, 'contradiction_rules.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),
  ('f1100300-0000-4000-8000-000000000000', 'R-20', 'UNKNOWN',
   'cross_record_detection_pending_rules', NULL, 'contradiction_rules.v1.0.0', '2026-09-11T00:00:00Z', 'Philip'),

-- ----- cross_substrate · bridge-mediated -----
  ('f1110100-0000-4000-8000-000000000000', 'cross_substrate', 'PASS',
   NULL, NULL, NULL, '2026-09-11T00:00:00Z', 'Philip'),
  ('f1110200-0000-4000-8000-000000000000', 'cross_substrate', 'CONTRADICTION_RECORDED',
   'cross_record_detection_deterministic', NULL, NULL, '2026-09-11T00:00:00Z', 'Philip'),
  ('f1110300-0000-4000-8000-000000000000', 'cross_substrate', 'UNKNOWN',
   'bridge_unresolvable', NULL, NULL, '2026-09-11T00:00:00Z', 'Philip')

ON CONFLICT (fixture_id, r_rule) DO NOTHING;

COMMIT;

-- ============================================================================
-- POST-POPULATION VERIFICATION QUERIES (run separately after apply)
-- ============================================================================
--
-- 1) Exactly 33 fixtures at fixture_set.v1.0.0:
--    SELECT COUNT(*) FROM nex_test.fixture_row WHERE fixture_set_version = 'fixture_set.v1.0.0';
--
-- 2) Every fixture has a matching expected verdict:
--    SELECT COUNT(*) FROM nex_test.fixture_row fr
--      LEFT JOIN nex_test.fixture_expected fe ON fr.fixture_id = fe.fixture_id
--      WHERE fe.fixture_id IS NULL;   -- expected 0
--
-- 3) No orphan expected rows:
--    SELECT COUNT(*) FROM nex_test.fixture_expected fe
--      LEFT JOIN nex_test.fixture_row fr ON fe.fixture_id = fr.fixture_id
--      WHERE fr.fixture_id IS NULL;   -- expected 0
--
-- 4) All fixtures are founder-authored:
--    SELECT COUNT(*) FROM nex_test.fixture_row WHERE founder_authored = false;   -- expected 0
--
-- 5) Fixture set version consistency:
--    SELECT DISTINCT fixture_set_version FROM nex_test.fixture_row;   -- expected 'fixture_set.v1.0.0' only
--
-- 6) Per-purpose distribution (11 rules × 3 purposes = 33):
--    SELECT r_rule, fixture_purpose, COUNT(*) FROM nex_test.fixture_row GROUP BY r_rule, fixture_purpose ORDER BY r_rule, fixture_purpose;
--
-- 7) Verdict distribution:
--    SELECT expected_verdict, COUNT(*) FROM nex_test.fixture_expected GROUP BY expected_verdict ORDER BY expected_verdict;
--
-- ============================================================================
