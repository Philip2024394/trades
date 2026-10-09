-- 172_nex_business_freshness_band.sql
--
-- NEX Directory Canonical Spine · migration 7 of 12 · freshness bands.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- Primitive 6 of the sealed 7-primitive spine.
--
-- WHAT THIS MIGRATION DOES
--   (1) Creates `nex.business_freshness_band(last_verified_at timestamptz)`
--       — an IMMUTABLE SQL function returning the sealed 5-value
--       freshness band for any canonical row.
--   (2) Creates `nex.business_freshness_v` view projecting
--       (canonical_business_id, entity_type, country, last_verified_at,
--        freshness_days, freshness_status) for every canonical.
--
--   This generalises the food-only `nex.food_business_freshness` view
--   from migration 066 across every entity_type in the sealed canonical
--   spine. The band logic + thresholds are byte-identical to 066 to
--   preserve the Walker Freshness Doctrine (Philip 2026-08-21, sealed
--   in 066's header).
--
-- SEALED BANDS (byte-identical to migration 066)
--   last_verified_at IS NULL                               → UNVERIFIED
--   now() − last_verified_at < 12 months                   → FRESH
--   now() − last_verified_at < 18 months                   → AGING
--   now() − last_verified_at < 24 months                   → STALE
--   otherwise                                              → EXPIRED
--
-- WHY A FUNCTION (not inline CASE in the view)
--   · The band is referenced in multiple places: this view, the
--     re-verification feeder (future), the publication-gate predicate
--     (future · DP wave may extend 175's L1 with a freshness clause),
--     admin dashboards, and client-side observability queries. One
--     function means one place to tune bands.
--   · IMMUTABLE lets the planner inline + fold constants when the view
--     is queried with a filter like `WHERE freshness_status = 'FRESH'`.
--   · Keeps the TypeScript resolver / consumers aligned on the SAME
--     band computation (any TS mirror imports the same thresholds and
--     unit-tests against this function via the pg-executor).
--
-- WHY NOT IMMUTABLE on `now()`
--   `now()` is STABLE, not IMMUTABLE. The sealed design intentionally
--   makes the DB-side band computation take `last_verified_at` as the
--   function argument and reads `now()` INSIDE the function body ·
--   this keeps the function STABLE (which the planner treats correctly
--   inside a view). If a future wave needs an IMMUTABLE band fn (for
--   generated-column use), it must take `(last_verified_at, as_of)`
--   as a two-argument IMMUTABLE function instead · do NOT alter this
--   one.
--
-- IDEMPOTENCE
--   CREATE OR REPLACE FUNCTION. CREATE OR REPLACE VIEW. Safe to re-run.
--
-- ROLLBACK
--   BEGIN;
--     DROP VIEW IF EXISTS nex.business_freshness_v;
--     DROP FUNCTION IF EXISTS nex.business_freshness_band(timestamptz);
--   COMMIT;
--
-- SAFE ON POPULATED DB
--   Yes. New function + new view. No ALTERs. No DML. No GRANT/REVOKE.
--   Zero impact on any current reader or writer.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a replacement for `nex.food_business_freshness` (migration
--     066). The food-only view keeps serving its existing consumers;
--     this spine-level view adds the generalised shape over
--     `nex.business_canonical` rows.
--   · Not a lifecycle promoter. Freshness decay from FRESH → EXPIRED
--     is a reporting band · the companion lifecycle transition from
--     ENRICHED/VERIFIED → DORMANT at 24-month expiry is a separate
--     DML wave written by the sealed canonical-handoff path.
--   · Not a publication predicate. The sealed publication gate (175)
--     uses lifecycle_state, not freshness band. A future wave may
--     tighten publication to require FRESH, but that is additive and
--     not part of this migration.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation.

-- ═══════════════════════════════════════════════════════════════════
-- (1) · nex.business_freshness_band(timestamptz) — sealed 5-band fn
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION nex.business_freshness_band(last_verified_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN last_verified_at IS NULL                                   THEN 'UNVERIFIED'
    WHEN now() - last_verified_at < interval '12 months'            THEN 'FRESH'
    WHEN now() - last_verified_at < interval '18 months'            THEN 'AGING'
    WHEN now() - last_verified_at < interval '24 months'            THEN 'STALE'
    ELSE                                                                 'EXPIRED'
  END;
$$;

COMMENT ON FUNCTION nex.business_freshness_band(timestamptz) IS
  'Sealed freshness band · generalises migration 066''s food-only logic across every entity_type in nex.business_canonical. Returns UNVERIFIED / FRESH / AGING / STALE / EXPIRED. STABLE because it reads now(); a future two-argument IMMUTABLE sibling may land for generated-column use.';

-- ═══════════════════════════════════════════════════════════════════
-- (2) · nex.business_freshness_v — spine-level freshness view
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW nex.business_freshness_v AS
SELECT
  bc.canonical_business_id,
  bc.entity_type,
  bc.country,
  bc.lifecycle_state,
  bc.last_verified_at,
  CASE
    WHEN bc.last_verified_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - bc.last_verified_at)) / 86400
  END::int AS freshness_days,
  nex.business_freshness_band(bc.last_verified_at) AS freshness_status
FROM nex.business_canonical bc;

COMMENT ON VIEW nex.business_freshness_v IS
  'Spine-level freshness projection over nex.business_canonical. One row per canonical with its band + days-since-last-verified. Admin surfaces, observability queries, and the future re-verification feeder read this view.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 172.
--
-- Downstream (172 does NOT ship these):
--   · nex.business_reverification_candidates_v — spine-level successor
--     to migration 066's nex.food_reverification_candidates (will JOIN
--     this view with lifecycle filter).
--   · Freshness-driven lifecycle transition (ENRICHED/VERIFIED → DORMANT
--     at EXPIRED band) — DML writer in the canonical-handoff path, not
--     a migration.
--   · Admin freshness dashboard — reads this view.
-- ═══════════════════════════════════════════════════════════════════
