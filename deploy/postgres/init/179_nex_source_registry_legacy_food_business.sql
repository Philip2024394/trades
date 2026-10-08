-- 179_nex_source_registry_legacy_food_business.sql
--
-- NEX Canonical · seed `nex_food_business_legacy` into
-- `nex.source_registry` (the sealed source-registry table from
-- migration 166).
--
-- WHY · WHAT · HOW TO APPLY
-- -------------------------
-- The legacy table `nex.food_business` carries NEX's first batch of
-- real food-business rows (22,757 Indonesian businesses). The sealed
-- source-adapter module `scripts/nex-canonical/source-legacy-food-
-- business.ts` already declares (line 56):
--
--     export const LEGACY_FOOD_SOURCE_ID = "nex_food_business_legacy"
--
-- Downstream enforcement — specifically the FK `fk_be_source` on
-- `nex.business_evidence(source_id)` added by migration 170 — refuses
-- any evidence insert whose cited `source_id` is not present in
-- `nex.source_registry`. The sealed canonical write path also refuses
-- to proceed when the registry row carries `can_derive = false` (see
-- `scripts/nex-canonical/canonical-handoff.ts` lines 541–546).
--
-- This migration adds the missing row so the sealed directory-
-- ingestion pipeline (candidate generation → founder approval →
-- canonical write) has a legitimate registry anchor for every real
-- row it ingests from `nex.food_business`.
--
-- Operator decision pinned by this migration
--   can_derive = TRUE. Reason: the legacy `nex.food_business` table
--   is owned by NEX and the derivation (projecting into the sealed
--   business_canonical + business_evidence primitives) is NEX's own
--   downstream transformation of its own data. Per migration 166's
--   SAFETY POSTURE comment, flipping `can_derive` away from its
--   restrictive default is an "admin UPDATE after legal review"
--   action — recorded here, in source control, so the operator
--   decision is auditable rather than ad-hoc psql.
--
-- The other policy flags stay at their migration-166 defaults:
--   can_collect           = TRUE   (safe · we already own this data)
--   can_store             = TRUE   (safe · already stored in NEX DB)
--   can_display           = FALSE  (publication is a downstream
--                                   lifecycle_state decision · not a
--                                   registry-wide blanket)
--   can_redistribute      = FALSE  (internal NEX data · no third-
--                                   party redistribution authorised)
--   attribution_required  = TRUE   (user-generated content inside
--                                   the legacy table may still need
--                                   NEX credit; admin may adjust
--                                   later)
--
-- Honest-null fields:
--   licence_id            = NULL   (same deferral posture as every
--                                   migration-166 seed row · formal
--                                   licence-identifier management
--                                   awaits a separate registry audit)
--   attribution_template  = NULL   (admin writes the exact string
--                                   later if required)
--   rate_limit_rps        = NULL   (not applicable · internal DB
--                                   read · no network rate limit)
--   base_host             = NULL   (not applicable · no external
--                                   HTTP host)
--
-- IDEMPOTENCY
--   INSERT ... ON CONFLICT (source_id) DO NOTHING. Safe to re-apply.
--   A pre-existing row with id `nex_food_business_legacy` is left
--   untouched; this migration never overwrites prior admin state.
--   The verification step (SELECT after apply) is where the operator
--   confirms the resulting shape matches intent.
--
-- RELATION TO THE EXISTING `nex.food_business` AD-HOC ROW
--   During the synthetic first-live-write proof, an ad-hoc row with
--   `source_id = 'nex.food_business'` was seeded directly (not via
--   migration) to satisfy the FK. That row stays untouched. It
--   belongs to the sealed synthetic proof; this migration adds a
--   SECOND row (`nex_food_business_legacy`) that is the proper
--   registry anchor for the sealed adapter and all future real
--   ingestion.
--
-- ROLLBACK
--   DELETE FROM nex.source_registry
--     WHERE source_id = 'nex_food_business_legacy';
--   Safe when no business_evidence or business_media row references
--   this source_id yet. Downstream FKs are RESTRICT by default; the
--   DELETE will refuse itself if any dependent rows exist.
--
-- SAFE ON POPULATED DB
--   Yes. Pure INSERT with ON CONFLICT DO NOTHING on a seed row. No
--   ALTERs, no GRANT/REVOKE, no DML on any other row.
--
-- NOT AUTO-APPLIED
--   Per the sealed migration discipline, `deploy/postgres/init/*.sql`
--   files are explicit manual-apply scripts, not an auto-run chain.
--   This migration is applied by the operator when authorised and
--   verified by the SELECT at the end of this comment block.

INSERT INTO nex.source_registry (
  source_id,
  source_type,
  display_name,
  can_derive
)
VALUES (
  'nex_food_business_legacy',
  'directory_import',
  'NEX Food Business (legacy table)',
  TRUE
)
ON CONFLICT (source_id) DO NOTHING;

-- End of migration 179.
--
-- Verification (operator runs this after apply):
--
--   SELECT source_id, source_type, can_derive, can_display,
--          can_redistribute, attribution_required
--   FROM nex.source_registry
--   WHERE source_id = 'nex_food_business_legacy';
--
-- Expected: exactly one row with can_derive=t, can_display=f,
--           can_redistribute=f, attribution_required=t.
