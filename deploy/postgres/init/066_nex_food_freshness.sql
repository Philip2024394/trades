-- 066_nex_food_freshness.sql
--
-- Walker Freshness Doctrine · Philip 2026-08-21.
--
-- Indonesia has a high business-churn environment. A directory record that is
-- 1-2 years old cannot automatically be treated as evidence the business is
-- still operating. Adds a freshness/re-verification layer to the existing
-- Universal Acquisition Engine.
--
-- Critical distinction:
--   source_observed_at   — when Walker/importer physically fetched the record
--                          (existing: source_ingested_at)
--   source_updated_at    — when the underlying source (OSM/permit/etc.) SAYS
--                          the record was last updated (NEW · nullable)
--   last_verified_at     — when NEX obtained CREDIBLE evidence the business
--                          is operating (NEW · nullable)
--   verification_source  — what evidence supports last_verified_at (NEW · nullable)
--                          'osm_element_timestamp' | 'website_fetch' |
--                          'owner_otp' | 'admin_manual' | 'walker_reverify'
--
-- Freshness bands (Philip verbatim):
--   0–12 months → FRESH
--   12–18 months → AGING (re-check candidate)
--   18–24 months → STALE (re-verification required)
--   24+ months → EXPIRED (cannot be presented as currently operating)
--   NULL last_verified_at → UNVERIFIED (never had credible evidence)
--
-- Constitutional rule (Philip verbatim):
--   NEX must not present a business as currently operating unless credible
--   operating evidence exists within the previous 12 months, OR the business
--   is explicitly labelled unverified/stale.
--
-- Historical records: PRESERVED. Never delete a business row for freshness.
-- Mark it appropriately instead.
--
-- Reversible:
--   BEGIN;
--   DROP VIEW IF EXISTS nex.food_reverification_candidates;
--   DROP VIEW IF EXISTS nex.food_business_freshness;
--   ALTER TABLE nex.food_business DROP COLUMN IF EXISTS source_updated_at;
--   ALTER TABLE nex.food_business DROP COLUMN IF EXISTS last_verified_at;
--   ALTER TABLE nex.food_business DROP COLUMN IF EXISTS verification_source;
--   COMMIT;

ALTER TABLE nex.food_business
  ADD COLUMN IF NOT EXISTS source_updated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS verification_source text;

COMMENT ON COLUMN nex.food_business.source_updated_at IS
  'When the underlying source (OSM element timestamp / permit update date / etc.) says the record was last updated. NULL when source does not expose this. This is NOT proof the business is still operating — see last_verified_at.';

COMMENT ON COLUMN nex.food_business.last_verified_at IS
  'When NEX last obtained credible evidence the business is CURRENTLY OPERATING. NULL = never had credible evidence. Owner OTP verification is strongest. OSM element timestamp is weakest (someone said it existed then). Website fetch success is medium. Freshness bands: <12mo FRESH, <18mo AGING, <24mo STALE, >=24mo EXPIRED.';

COMMENT ON COLUMN nex.food_business.verification_source IS
  'osm_element_timestamp | website_fetch | owner_otp | admin_manual | walker_reverify. Tracks the source of last_verified_at.';

-- ── Freshness view · deterministic band derivation ─────────────────────────

CREATE OR REPLACE VIEW nex.food_business_freshness AS
SELECT
  b.public_listing_ref,
  b.business_name,
  b.city,
  b.claim_status,
  b.owner_status,
  b.source,
  b.source_ingested_at,
  b.source_updated_at,
  b.last_verified_at,
  b.verification_source,
  CASE
    WHEN b.last_verified_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - b.last_verified_at)) / 86400
  END::int AS freshness_days,
  CASE
    WHEN b.last_verified_at IS NULL THEN 'UNVERIFIED'
    WHEN now() - b.last_verified_at < interval '12 months' THEN 'FRESH'
    WHEN now() - b.last_verified_at < interval '18 months' THEN 'AGING'
    WHEN now() - b.last_verified_at < interval '24 months' THEN 'STALE'
    ELSE 'EXPIRED'
  END AS freshness_status
FROM nex.food_business b;

COMMENT ON VIEW nex.food_business_freshness IS
  'Deterministic freshness band per business. Read by admin surfaces + Commercial Universe filter (when opted in). Discovery date does NOT masquerade as verification date — freshness is derived from last_verified_at ONLY.';

-- ── Re-verification candidates view · Walker feeder for the re-verify loop ─
--
-- Records approaching or past the 12-month threshold that could be
-- re-verified. Ordered by staleness so most-urgent surface first.
-- Walker's future re-verify mode reads from this view.

CREATE OR REPLACE VIEW nex.food_reverification_candidates AS
SELECT
  b.public_listing_ref,
  b.business_name,
  b.category,
  b.city,
  b.district,
  b.coordinates_lat,
  b.coordinates_lng,
  b.source,
  b.source_reference,
  b.last_verified_at,
  b.verification_source,
  f.freshness_status,
  f.freshness_days
FROM nex.food_business b
JOIN nex.food_business_freshness f USING (public_listing_ref)
WHERE b.claim_status IN ('listed', 'invited', 'claimed', 'paying', 'discovered')
  AND (
    f.freshness_status IN ('AGING', 'STALE', 'EXPIRED')
    OR (f.freshness_status = 'UNVERIFIED' AND b.claim_status = 'listed')
  )
ORDER BY
  CASE f.freshness_status
    WHEN 'EXPIRED'    THEN 1
    WHEN 'STALE'      THEN 2
    WHEN 'AGING'      THEN 3
    WHEN 'UNVERIFIED' THEN 4
    ELSE 5
  END,
  b.last_verified_at NULLS LAST;

COMMENT ON VIEW nex.food_reverification_candidates IS
  'Businesses needing re-verification. Walker re-verify mode (future) picks from this view. Ordered by urgency: EXPIRED first, then STALE, AGING, UNVERIFIED-but-listed. Successful re-verify updates last_verified_at + verification_source. Failed re-verify leaves the record alone (does NOT auto-delete).';

-- ── Aggregate freshness view · for HQ tile ─────────────────────────────────

CREATE OR REPLACE VIEW nex.food_business_freshness_summary AS
SELECT
  city,
  count(*) FILTER (WHERE freshness_status = 'FRESH')::int      AS fresh,
  count(*) FILTER (WHERE freshness_status = 'AGING')::int      AS aging,
  count(*) FILTER (WHERE freshness_status = 'STALE')::int      AS stale,
  count(*) FILTER (WHERE freshness_status = 'EXPIRED')::int    AS expired,
  count(*) FILTER (WHERE freshness_status = 'UNVERIFIED')::int AS unverified,
  count(*)::int AS total
FROM nex.food_business_freshness
GROUP BY city;
