-- 171_nex_business_evidence_backfill.sql
--
-- NEX Directory Canonical Spine · migration 6 of 12 · evidence backfill
-- scaffolding.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- WHAT THIS MIGRATION DOES
--   Materialises one `nex.business_evidence` row per legacy food-business
--   row that ALREADY HAS a `canonical_business_id` populated (migration
--   169 added the column; a separately authorised resolver-driven
--   backfill wave populates values). The materialised evidence row
--   carries a `migration-171-scaffold` observation_generator stamp so
--   it is distinguishable from resolver-produced evidence.
--
--   This migration is IDEMPOTENT and INERT WHEN APPLIED BEFORE THE
--   BACKFILL WAVE. It only INSERTs for legacy rows where:
--     (a) `nex.food_business.canonical_business_id IS NOT NULL` AND
--     (b) no `nex.business_evidence` row already exists for that
--         canonical with observation_generator = 'migration-171-scaffold'
--
--   On a fresh apply with zero backfilled legacy rows, the INSERT ...
--   SELECT returns zero rows and the migration completes as a no-op.
--
-- WHY SCAFFOLDING (not real evidence)
--   The sealed canonical-handoff path (`scripts/nex-canonical/canonical-
--   handoff.ts`) is the ONLY authorised writer of evidence rows with
--   full HandoffEvidence shape (DecisionRecord hash, ReviewPackage
--   hash, Candidate integrity hash). This migration cannot produce
--   those hashes · the Candidates were never materialised through the
--   sealed path for pre-spine legacy rows.
--
--   This migration therefore writes evidence rows with:
--     · schema_version = 'evidence-v1' (sealed CHECK)
--     · observation_generator = 'migration-171-scaffold'
--     · candidate_id = legacy row's internal_id or public_listing_ref
--     · candidate_integrity_hash = sha256(stable JSON of the legacy row)
--     · decision_record_id = sha256('migration-171:' || canonical_id)
--     · review_package_id = sha256('migration-171-package:' || canonical_id)
--     · resolver_verdict_kind = 'NO_MATCH' (we're attesting the row's
--       first appearance)
--     · resolver_target_id = NULL (NO_MATCH)
--     · resolver_score = 0.0 (no resolver was run)
--     · source_id = 'nex_food_business_legacy' (migration 179)
--
--   These rows satisfy the sealed CHECK constraints on
--   `nex.business_evidence` BUT their observation_generator stamp lets
--   downstream auditors distinguish scaffolding from the real resolver
--   backfill. A future wave can REPLACE scaffold rows with resolver-
--   produced rows (preserving the audit trail by keeping the scaffold
--   row and INSERTing an additional resolver row).
--
-- SCOPE · FOOD ONLY FOR THIS WAVE
--   Only `nex.food_business` has a seeded `nex.source_registry` row
--   (`nex_food_business_legacy` via migration 179) with
--   `can_derive = TRUE`. The other legacy verticals
--   (accommodation / service / mp_seller / transport) need their own
--   source_registry seed rows before 171 can be extended to them.
--   The future seed-row waves land as sibling migrations
--   (179-equivalents · one per vertical). This file scaffolds food
--   today.
--
-- IDEMPOTENCE
--   INSERT ... SELECT ... WHERE NOT EXISTS. Safe to re-run; adds no
--   rows for canonicals that already have a scaffold evidence row.
--
-- ROLLBACK
--   DELETE FROM nex.business_evidence
--     WHERE observation_generator = 'migration-171-scaffold';
--
-- SAFE ON POPULATED DB
--   Yes. INSERTs are scoped to legacy rows that THE RESOLVER BACKFILL
--   WAVE has already touched (via `canonical_business_id` populated).
--   Rows the resolver has not yet touched are not affected.
--   Zero ALTERs. No GRANT/REVOKE.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a resolver. No matching. No scoring. Takes `canonical_
--     business_id` from the legacy row as given.
--   · Not a canonical writer. `nex.business_canonical` is not touched.
--     This file ONLY INSERTs into `nex.business_evidence`.
--   · Not Rule-5m seven-proof satisfaction. The seven proofs still
--     apply to the resolver-driven backfill (which writes canonical
--     + evidence in one txn). This scaffolding exists for canonical
--     rows that ALREADY have an admin-signed-off canonical_business_id.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167
--   · nex.business_evidence: migration 170
--   · nex.source_registry: migration 166
--   · nex_food_business_legacy row seeded: migration 179
--   · canonical_business_id column on nex.food_business: migration 169
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation.
--   On apply BEFORE the resolver backfill wave, this migration is a
--   no-op (zero legacy rows have canonical_business_id populated).

-- ═══════════════════════════════════════════════════════════════════
-- Food-business evidence scaffolding
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO nex.business_evidence (
  canonical_business_id,
  schema_version,
  candidate_id,
  candidate_integrity_hash,
  decision_record_id,
  review_package_id,
  legacy_source_table,
  legacy_source_ref,
  legacy_source_internal_id,
  resolver_verdict_kind,
  resolver_target_id,
  resolver_score,
  observation_generator,
  observation_run_id,
  observation_generated_at,
  observation_decision_timestamp,
  observation_founder_id,
  source_id
)
SELECT
  fb.canonical_business_id,
  'evidence-v1',
  -- candidate_id · the legacy row's public_listing_ref is the stable
  -- business reference per migration 054.
  fb.public_listing_ref,
  -- candidate_integrity_hash · sha256 of a stable projection of the
  -- legacy row's identity columns. Uses a deterministic concatenation
  -- rather than row_to_json so re-running produces the same hash even
  -- if column ordering changes in future.
  encode(digest(
    'legacy-fb:' ||
    coalesce(fb.public_listing_ref, '') || '|' ||
    coalesce(fb.business_name, '')      || '|' ||
    coalesce(fb.city, '')               || '|' ||
    coalesce(fb.phone, ''),
    'sha256'
  ), 'hex'),
  -- decision_record_id · deterministic hash so re-run is stable.
  encode(digest(
    'migration-171-decision:' || fb.canonical_business_id::text,
    'sha256'
  ), 'hex'),
  -- review_package_id · deterministic hash so re-run is stable.
  encode(digest(
    'migration-171-package:' || fb.canonical_business_id::text,
    'sha256'
  ), 'hex'),
  -- Legacy source identity (satisfies the sealed non-blank CHECKs).
  'nex.food_business',
  fb.public_listing_ref,
  fb.internal_id::text,
  -- resolver_verdict · NO_MATCH (initial attestation).
  'NO_MATCH',
  NULL,                                          -- resolver_target_id (NO_MATCH)
  0.0::double precision,                         -- resolver_score (no resolver run)
  -- Observation provenance.
  'migration-171-scaffold',
  'migration-171:' || to_char(now(), 'YYYY-MM-DD'),
  now(),                                         -- observation_generated_at
  now(),                                         -- observation_decision_timestamp
  'system:migration-171',                        -- observation_founder_id
  'nex_food_business_legacy'                     -- source_id (migration 179)
FROM nex.food_business fb
WHERE fb.canonical_business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM nex.business_evidence be
    WHERE be.canonical_business_id = fb.canonical_business_id
      AND be.observation_generator = 'migration-171-scaffold'
  );

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 171.
--
-- Operator verification (expected zero rows BEFORE the resolver
-- backfill wave; expected N rows after it, where N = number of
-- backfilled legacy rows):
--
--   SELECT COUNT(*) FROM nex.business_evidence
--     WHERE observation_generator = 'migration-171-scaffold';
--
-- Downstream (171 does NOT ship these):
--   · Equivalent scaffolding migrations for the accommodation / service /
--     mp_seller / transport verticals (require per-vertical
--     source_registry seed rows first).
--   · Resolver-driven backfill wave that REPLACES scaffold rows with
--     full HandoffEvidence provenance (keeps scaffold rows for audit,
--     adds resolver rows alongside).
-- ═══════════════════════════════════════════════════════════════════
