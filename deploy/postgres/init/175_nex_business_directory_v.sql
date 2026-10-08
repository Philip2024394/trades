-- 175_nex_business_directory_v.sql
--
-- NEX Canonical · Directory Publication Gate · Phase 1 of 2.
--
-- CREATES
--   nex.business_directory_v — the SEALED visitor-publication view.
--   The one object the Directory service is architecturally
--   permitted to read for visitor rendering (the service switch
--   lands in DP-2). Every row returned by this view is cleared for
--   visitor discovery by sealed predicates applied inside the view
--   itself; no caller is permitted to independently decide what is
--   publishable.
--
-- WHY (founder-sealed 2026-10-09 · see audit "NEX Directory ·
-- Publication-Gate Audit · 2026-10-09")
--   `nex.business_canonical` holds canonical TRUTH (what we know).
--   Visitor safety is a DIFFERENT concern (what we may show).
--   Collapsing these two concerns created the synthetic-row defect
--   (synthetic first-live-write proof was surfaced as a visitor
--   listing merely because its lifecycle_state was DISCOVERED).
--
--   The correct architectural split is:
--
--       nex.business_canonical    (canonical truth)
--            │
--            ▼
--       nex.business_directory_v  (publication gate · THIS VIEW)
--            │
--            ▼
--       directory-service.ts      (read-only consumer)
--            │
--            ▼
--       Directory UI              (visitor render)
--
--   The service NEVER reads nex.business_canonical for visitor
--   rendering after DP-2 lands. The view is the exclusive
--   publication boundary.
--
-- SEALED PREDICATES (founder decisions D-1 · D-2 · D-3)
--
--   D-1  publishable lifecycle set L1:
--        lifecycle_state ∈ { VERIFIED, OWNER_CLAIMED, OWNER_VERIFIED }
--
--        Deliberately EXCLUDES:
--          DISCOVERED  — "canonical identity exists · not visitor-cleared"
--          ENRICHED    — "more evidence exists · not yet publication-cleared"
--          DORMANT     — "fresh evidence older than 24 months"
--          SUPERSEDED  — "merged into another canonical (terminal)"
--
--   D-2  source-permission is permission-OR:
--        EXISTS at least one evidence row whose cited
--        source_registry.can_display = TRUE.
--
--        A row with mixed evidence (some sources can_display=TRUE,
--        others FALSE) is publishable — the TRUE source is the
--        legal authorisation. This matches the sealed intent in
--        migration 166: "may NEX render it to a user?" is a per-
--        source permission that composes OR-wise across the
--        evidence set.
--
--   D-3  business_fact_conflict predicate deferred:
--        Migration 174 (nex.business_fact_conflict) is UNAUTHORED.
--        When it lands, the publication predicate must gain a
--        4th clause:
--
--          AND NOT EXISTS (
--            SELECT 1 FROM nex.business_fact_conflict bfc
--            WHERE bfc.canonical_business_id = bc.canonical_business_id
--              AND bfc.resolution_state = 'OPEN'
--          )
--
--        That addition is a `CREATE OR REPLACE VIEW` operation
--        inside the migration-174 wave. This 175 is intentionally
--        light on that hook so it ships without a dependency on an
--        unauthored migration.
--
--   D-4  GRANT/REVOKE sweep deferred to DP-3:
--        This migration does NOT grant or revoke any permission.
--        The sealed lockdown that removes direct SELECT on
--        nex.business_canonical from the Directory role is a
--        separate authorised wave. Until DP-3, operators and
--        tooling retain their current ad-hoc read access.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a table. No row storage. Pure SELECT projection.
--   · Not a lifecycle promotion. Does NOT change any row's
--     lifecycle_state.
--   · Not a source-permission change. Does NOT alter can_display
--     on any source.
--   · Not a canonical mutator. ZERO INSERT / UPDATE / DELETE /
--     TRUNCATE anywhere.
--   · Not a synthetic recogniser. Contains ZERO reference to the
--     synthetic row's name_canonical, candidate_id, or UUID. The
--     synthetic row disappears from the view because its evidence
--     source (nex.food_business) has can_display=FALSE · the
--     sealed permission flag already carries the correct signal.
--   · Not a GRANT or REVOKE statement.
--   · Not a new table or index.
--
-- COLUMN CONTRACT (byte-stable with directory-service's SELECT_COLUMNS)
--   Every column the sealed `src/lib/nex-native/directory/directory-
--   service.ts` SELECT_COLUMNS constant reads from nex.business_canonical
--   is exposed through this view with identical name and type. The
--   service's SELECT_COLUMNS is drop-in compatible after DP-2 flips
--   its FROM clause.
--
--   Columns are enumerated explicitly (not `SELECT bc.*`) so the
--   view's output contract is auditable and resistant to drift:
--   a future column added to nex.business_canonical is NOT silently
--   exposed to the view (and therefore to visitors) · a conscious
--   CREATE OR REPLACE VIEW is required to admit it.
--
--   `coordinates geography(Point, 4326)` is exposed as the raw
--   PostGIS column; the sealed service continues to project
--   `ST_Y(coordinates::geometry) AS coordinates_lat` and
--   `ST_X(coordinates::geometry) AS coordinates_lng` from the view
--   identically to how it does today from the base table.
--
-- IDEMPOTENCY
--   CREATE OR REPLACE VIEW. Safe to re-run.
--
-- ROLLBACK
--   DROP VIEW IF EXISTS nex.business_directory_v;
--   (No FKs point at a view; no downstream dependency gets broken
--    beyond directory-service.ts, which can be reverted in parallel.)
--
-- SAFE ON POPULATED DB
--   Yes. Pure CREATE OR REPLACE VIEW. No DDL on existing tables.
--   No DML. No GRANT. No REVOKE. Zero impact on any existing writer
--   or reader of nex.business_canonical, nex.business_evidence, or
--   nex.source_registry.
--
-- SELECT UNDER CURRENT STATE (what you should see after apply)
--   SELECT COUNT(*) FROM nex.business_directory_v;
--   -- Expected: 0
--   --
--   -- Reason: as of this authorization every canonical row (synthetic
--   -- + 7 real) is lifecycle_state=DISCOVERED (fails L1) AND cites a
--   -- source with can_display=FALSE (fails D-2). Both gates
--   -- independently exclude every current row. The empty result is
--   -- the architecturally correct state: no row has been cleared
--   -- for visitor publication yet. Promotion to publishable is a
--   -- separate authorised sequence (lifecycle promotion + source
--   -- legal review flipping can_display).

-- ═══════════════════════════════════════════════════════════════════
-- The sealed publication view
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
  -- D-1 · publishable lifecycle set L1
  bc.lifecycle_state IN ('VERIFIED', 'OWNER_CLAIMED', 'OWNER_VERIFIED')
  -- Supersession guard (defence in depth · DP's row-level invariant
  -- already excludes SUPERSEDED lifecycle; this clause also catches
  -- any OWNER_VERIFIED row that is in the process of being merged
  -- away but has not yet transitioned to SUPERSEDED).
  AND bc.superseded_by_business_id IS NULL
  -- D-2 · at least one evidence row cites a source authorised for
  -- visitor display. Permission-OR aggregation across evidence set.
  AND EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr
      ON sr.source_id = be.source_id
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr.can_display = TRUE
  );
-- D-3 · business_fact_conflict predicate hook:
--   when migration 174 lands, append the following clause to the
--   WHERE and re-run this migration (CREATE OR REPLACE VIEW):
--     AND NOT EXISTS (
--       SELECT 1 FROM nex.business_fact_conflict bfc
--       WHERE bfc.canonical_business_id = bc.canonical_business_id
--         AND bfc.resolution_state = 'OPEN'
--     )
--   No action required in this migration · the view's current
--   result set correctly reflects reality today (174 unauthored).

COMMENT ON VIEW nex.business_directory_v IS
  'Sealed Directory publication gate (migration 175). The only object the Directory service is architecturally permitted to read for visitor rendering. Enforces lifecycle L1 (VERIFIED, OWNER_CLAIMED, OWNER_VERIFIED), supersession guard, and permission-OR source-display aggregation. Downstream: migration 174 adds the open-conflict predicate; DP-3 adds the GRANT/REVOKE lockdown on nex.business_canonical.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 175.
--
-- Downstream (175 does NOT ship these):
--   174 · nex.business_fact_conflict (unauthored · adds 4th predicate)
--   DP-3 · GRANT/REVOKE sweep (separate authorisation)
-- ═══════════════════════════════════════════════════════════════════
