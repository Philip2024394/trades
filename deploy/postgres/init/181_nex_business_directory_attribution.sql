-- 181_nex_business_directory_attribution.sql
--
-- NEX Canonical · Directory Publication Gate · A-2 Phase 2 of 2.
--
-- EXTENDS and ADDS:
--   · `nex.business_directory_v` (sealed in migration 175) · gains
--     the fail-closed attribution-template-present predicate and the
--     one-hop chain-aware source-permission resolution.
--   · `nex.business_directory_attribution_v` (NEW) · the sibling
--     view the Directory service reads to populate per-row
--     attribution entries.
--
-- Founder decisions sealed in this migration (A-1, 2026-10-09):
--   D-A3 · attribution text comes exclusively from
--          source_registry.attribution_template.
--   D-A5 · fail-closed · publication refuses when attribution is
--          required but missing/blank.
--   D-A6 · enforcement lives inside the publication view plus a
--          sibling attribution view, never in TypeScript.
--   D-A8 · one-hop derived_from_source_id chain resolves to the
--          licensing-origin; the view walks via COALESCE.
--
-- CHAIN RESOLUTION
--   Every evidence row cites a `source_id`. That source may be an
--   origin (derived_from_source_id IS NULL) or a NEX-internal
--   derivative (derived_from_source_id → origin). The sealed
--   semantic is: the licensing-origin's `can_display` and
--   `attribution_template` govern publication.
--
--   The views below resolve the citation by:
--
--     sr_direct.source_id = be.source_id   -- direct citation
--     sr_origin.source_id = COALESCE(sr_direct.derived_from_source_id,
--                                    be.source_id)
--
--   For an origin citation, both sides collapse to the same row.
--   For a derivative citation, sr_origin is the chain-ultimate
--   ancestor (one hop · the sealed invariant from migration 180).
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a value-write. ZERO row INSERT / UPDATE / DELETE in any
--     table. Pure view projection.
--   · Not a can_display or attribution_template write. The views
--     only READ what migration 180 and the earlier A-1 operator
--     wave would have set.
--   · Not a lifecycle promotion. The publishable set remains L1
--     (VERIFIED, OWNER_CLAIMED, OWNER_VERIFIED) sealed by migration
--     175.
--   · Not a GRANT or REVOKE. DP-3 is a separate wave.
--   · Not an N-hop resolver. The views walk exactly one hop. The
--     one-hop invariant is sealed in migration 180's header.
--   · Not a materialised view. These are plain views · they
--     recompute on every SELECT. If future volume requires
--     materialisation, that is a separate wave with its own
--     refresh contract.
--
-- IDEMPOTENCY
--   CREATE OR REPLACE VIEW for both. Safe to re-run. The main view
--   definition is deliberately re-authored in full (not an in-place
--   edit of migration 175) so applying 175 → 180 → 181 produces the
--   correct final shape regardless of apply order (as long as 180
--   precedes 181, which the ordinal numbering enforces).
--
-- ROLLBACK
--   DROP VIEW IF EXISTS nex.business_directory_attribution_v;
--   -- To revert the main view to migration 175's shape, re-apply
--   -- migration 175. CREATE OR REPLACE VIEW is bidirectionally safe.
--
-- SAFE ON POPULATED DB
--   Yes. Pure CREATE OR REPLACE VIEW. No DDL on existing tables.
--   No DML.

-- ═══════════════════════════════════════════════════════════════════
-- (1) · business_directory_v · extend with chain + attribution gate
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW nex.business_directory_v AS
SELECT
  bc.canonical_business_id,
  bc.entity_type,
  bc.country,
  bc.lifecycle_state,
  bc.name_canonical,
  bc.name_norm,
  bc.aliases,
  bc.phone_e164,
  bc.website_apex,
  bc.osm_id,
  bc.wikidata_qid,
  bc.city,
  bc.district,
  bc.street_line,
  bc.neighbourhood,
  bc.address,
  bc.coordinates,
  bc.category_ids,
  bc.services_products,
  bc.supersedes_business_id,
  bc.superseded_by_business_id,
  bc.last_verified_at,
  bc.created_at,
  bc.updated_at
FROM nex.business_canonical bc
WHERE
  -- D-1 · publishable lifecycle set L1 (sealed by migration 175)
  bc.lifecycle_state IN ('VERIFIED', 'OWNER_CLAIMED', 'OWNER_VERIFIED')
  -- Supersession guard (sealed by migration 175)
  AND bc.superseded_by_business_id IS NULL
  -- D-2 · at least one evidence source whose chain-resolved origin
  -- has can_display = TRUE (one-hop walk via COALESCE)
  AND EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr_direct
      ON sr_direct.source_id = be.source_id
    JOIN nex.source_registry sr_origin
      ON sr_origin.source_id = COALESCE(
           sr_direct.derived_from_source_id,
           be.source_id
         )
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr_origin.can_display = TRUE
  )
  -- D-5 · fail-closed · every attribution-required chain-resolved
  -- origin cited by this canonical must have a non-blank
  -- attribution_template. If any cited origin requires attribution
  -- and lacks a template, this row is NOT publishable. Belt-and-
  -- braces alongside migration 180's CHECK constraint.
  AND NOT EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr_direct
      ON sr_direct.source_id = be.source_id
    JOIN nex.source_registry sr_origin
      ON sr_origin.source_id = COALESCE(
           sr_direct.derived_from_source_id,
           be.source_id
         )
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr_origin.attribution_required = TRUE
      AND (
        sr_origin.attribution_template IS NULL
        OR length(trim(sr_origin.attribution_template)) = 0
      )
  );
-- D-3 · business_fact_conflict predicate hook (unchanged from
--   migration 175): when migration 174 lands, append the clause
--   `AND NOT EXISTS (SELECT 1 FROM nex.business_fact_conflict
--   WHERE … AND resolution_state = 'OPEN')` and re-apply.

COMMENT ON VIEW nex.business_directory_v IS
  'Sealed Directory publication gate (migration 175 + 181). The only object the Directory service is architecturally permitted to read for visitor rendering. Enforces lifecycle L1, supersession guard, chain-resolved permission (D-A8 one-hop via source_registry.derived_from_source_id), and fail-closed attribution-template-present (D-A5). Downstream: migration 174 adds the open-conflict predicate; DP-3 adds the GRANT/REVOKE lockdown.';

-- ═══════════════════════════════════════════════════════════════════
-- (2) · business_directory_attribution_v · the sibling attribution view
-- ═══════════════════════════════════════════════════════════════════
--
-- Returns one row per (canonical_business_id, chain-resolved origin
-- source) for every publishable row whose origin is attribution_
-- required and has a non-blank attribution_template.
--
-- Semantics:
--   · The sibling view is RESTRICTED to canonicals that ALSO appear
--     in nex.business_directory_v. A visitor-facing attribution for
--     a non-publishable row would leak that the row exists.
--   · DISTINCT deduplicates when multiple evidence rows cite the
--     same chain-resolved origin.
--   · Returns `text` as the attribution_template content.
--     Byte-equal to source_registry.attribution_template.
--
-- The Directory service queries this view with the list of
-- canonical_business_ids currently rendering, aggregates by
-- source_id into a page-level DirectoryPageAttribution, and
-- deduplicates once more at the VM layer (defence in depth).

CREATE OR REPLACE VIEW nex.business_directory_attribution_v AS
SELECT DISTINCT
  bdv.canonical_business_id,
  sr_origin.source_id,
  sr_origin.attribution_template AS text
FROM nex.business_directory_v bdv
JOIN nex.business_evidence be
  ON be.canonical_business_id = bdv.canonical_business_id
JOIN nex.source_registry sr_direct
  ON sr_direct.source_id = be.source_id
JOIN nex.source_registry sr_origin
  ON sr_origin.source_id = COALESCE(
       sr_direct.derived_from_source_id,
       be.source_id
     )
WHERE sr_origin.can_display = TRUE
  AND sr_origin.attribution_required = TRUE
  AND sr_origin.attribution_template IS NOT NULL
  AND length(trim(sr_origin.attribution_template)) > 0;

COMMENT ON VIEW nex.business_directory_attribution_v IS
  'Sealed Directory attribution sibling view (migration 181). One row per (publishable canonical_business_id, chain-resolved origin source) carrying the origin''s attribution_template. The Directory service aggregates these into page-level/row-level DirectoryPageAttribution for render. Restricted to canonicals already admitted by business_directory_v so no non-publishable row''s attribution leaks.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 181.
-- ═══════════════════════════════════════════════════════════════════
