-- 185_nex_source_registry_legacy_accommodation.sql
--
-- NEX Canonical · seed `nex_accommodation_business_legacy` into
-- `nex.source_registry` (the sealed source-registry table from
-- migration 166).
--
-- WHY · WHAT · HOW TO APPLY
-- -------------------------
-- The legacy table `nex.accommodation_business` carries NEX's first
-- batch of real accommodation-business rows (9,230 Indonesian
-- businesses confirmed by live probe 2026-10-09, all country='ID').
-- The sealed source-adapter module `scripts/nex-canonical/source-
-- legacy-accommodation-business.ts` declares (see
-- LEGACY_ACCOMMODATION_SOURCE_ID):
--
--     export const LEGACY_ACCOMMODATION_SOURCE_ID =
--       "nex_accommodation_business_legacy"
--
-- Downstream enforcement — specifically the FK `fk_be_source` on
-- `nex.business_evidence(source_id)` added by migration 170 — refuses
-- any evidence insert whose cited `source_id` is not present in
-- `nex.source_registry`. The sealed canonical write path also refuses
-- to proceed when the registry row carries `can_derive = false` (see
-- `scripts/nex-canonical/canonical-handoff.ts`).
--
-- This migration adds the missing row so the sealed directory-
-- ingestion pipeline (candidate generation → founder approval →
-- canonical write) has a legitimate registry anchor for every real
-- row it ingests from `nex.accommodation_business`.
--
-- Operator decision pinned by this migration
--   can_derive = TRUE. Reason: the legacy `nex.accommodation_business`
--   table is owned by NEX and the derivation (projecting into the
--   sealed business_canonical + business_evidence primitives) is
--   NEX's own downstream transformation of its own data. Per migration
--   166's SAFETY POSTURE comment, flipping `can_derive` away from its
--   restrictive default is an "admin UPDATE after legal review" action
--   — recorded here, in source control, so the operator decision is
--   auditable rather than ad-hoc psql.
--
--   can_display stays at its migration-166 FALSE default. Publication
--   of accommodation listings is explicitly BLOCKED at the registry
--   layer until a legal-review pass clears the source of record
--   (`source='osm_overpass'` carries ODbL attribution requirements
--   that must be reconciled with the public listing surface before
--   can_display may be flipped). This mirrors the posture of migration
--   179 for `nex_food_business_legacy` and keeps the gate explicit:
--   the adapter can discover + propose candidates, but the directory
--   will not publish them until an admin UPDATE sets can_display=TRUE
--   after legal review.
--
-- The other policy flags stay at their migration-166 defaults:
--   can_collect           = TRUE   (safe · we already own this data)
--   can_store             = TRUE   (safe · already stored in NEX DB)
--   can_display           = FALSE  (publication blocked pending legal
--                                   review of the OSM attribution
--                                   requirements · see note above)
--   can_redistribute      = FALSE  (internal NEX data · no third-
--                                   party redistribution authorised)
--   attribution_required  = TRUE   (OSM-derived content inside the
--                                   legacy table carries ODbL
--                                   attribution; admin may adjust the
--                                   exact attribution_template later)
--
-- Honest-null fields:
--   licence_id            = NULL   (same deferral posture as every
--                                   migration-166 seed row · formal
--                                   licence-identifier management
--                                   awaits a separate registry audit)
--   attribution_template  = NULL   (admin writes the exact string
--                                   later if required · note that OSM
--                                   content needs a stable attribution
--                                   string before can_display flips)
--   rate_limit_rps        = NULL   (not applicable · internal DB
--                                   read · no network rate limit)
--   base_host             = NULL   (not applicable · no external
--                                   HTTP host)
--
-- IDEMPOTENCY
--   INSERT ... ON CONFLICT (source_id) DO NOTHING. Safe to re-apply.
--   A pre-existing row with id `nex_accommodation_business_legacy` is
--   left untouched; this migration never overwrites prior admin state.
--   The verification step (SELECT after apply) is where the operator
--   confirms the resulting shape matches intent.
--
-- RELATION TO EXISTING `nex.accommodation_business` AD-HOC ROWS
--   None expected. If a prior ad-hoc row exists under a different
--   source_id (e.g. 'nex.accommodation_business'), it stays untouched.
--   This migration adds the canonical registry anchor for the sealed
--   adapter path · ad-hoc rows from earlier probes are a separate
--   decision and are NOT touched here.
--
-- ROLLBACK
--   DELETE FROM nex.source_registry
--     WHERE source_id = 'nex_accommodation_business_legacy';
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
  'nex_accommodation_business_legacy',
  'directory_import',
  'NEX Accommodation Business (legacy table)',
  TRUE
)
ON CONFLICT (source_id) DO NOTHING;

-- End of migration 185.
--
-- Verification (operator runs this after apply):
--
--   SELECT source_id, source_type, can_derive, can_display,
--          can_redistribute, attribution_required
--   FROM nex.source_registry
--   WHERE source_id = 'nex_accommodation_business_legacy';
--
-- Expected: exactly one row with can_derive=t, can_display=f,
--           can_redistribute=f, attribution_required=t.
