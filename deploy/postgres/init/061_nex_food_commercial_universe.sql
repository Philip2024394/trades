-- 061_nex_food_commercial_universe.sql
--
-- NEX Food · Two Universes distinction (Philip 2026-08-21 · CONSTITUTIONAL).
--
-- DISCOVERY UNIVERSE  = nex.food_business (every business found · any source)
-- COMMERCIAL UNIVERSE = subset that NEX can actually reach + acquire + convert
--
-- Rules for the commercial universe view (LOCKED):
--   1. claim_status must be 'listed' or higher (admin has verified the row)
--   2. MUST have at least one usable contact destination (whatsapp OR phone)
--   3. MUST NOT be on the outreach suppression list (for any channel)
--   4. Also flags rows with ambiguous_identity_pending so admin can resolve
--
-- Downstream consumers:
--   · HQ dashboard funnel top-row (Discovery / Commercial / Ratio)
--   · Phase 8.4 campaign audience filters (never touch discovery-only rows)
--   · Value engine target set (a business with no contact cannot generate
--     qualified enquiries · not measured against)
--
-- Reversible:
--   BEGIN;
--   DROP VIEW IF EXISTS nex.food_commercial_universe;
--   COMMIT;

CREATE OR REPLACE VIEW nex.food_commercial_universe AS
SELECT
  b.public_listing_ref,
  b.internal_id,
  b.business_name,
  b.category,
  b.city,
  b.district,
  b.whatsapp_number,
  b.phone,
  b.website,
  b.claim_status,
  b.owner_status,
  -- The reason a business made it to the commercial universe
  CASE
    WHEN b.whatsapp_number IS NOT NULL AND b.whatsapp_number <> '' THEN 'whatsapp'
    WHEN b.phone IS NOT NULL AND b.phone <> ''                    THEN 'phone'
    ELSE 'unknown'
  END AS primary_contact_channel,
  -- Ambiguous identity flag · admin must resolve before outreach eligibility
  EXISTS(
    SELECT 1 FROM nex.food_enrichment_job j
    WHERE j.business_ref = b.public_listing_ref
      AND j.status = 'needs_review'
  ) AS ambiguous_identity_pending
FROM nex.food_business b
WHERE b.claim_status IN ('listed', 'invited', 'claimed', 'paying')
  AND (
       (b.whatsapp_number IS NOT NULL AND b.whatsapp_number <> '')
    OR (b.phone           IS NOT NULL AND b.phone           <> '')
  )
  AND NOT EXISTS(
    SELECT 1 FROM nex.food_outreach_suppression sup
    WHERE sup.business_ref = b.public_listing_ref
      AND sup.channel IS NULL   -- ALL-channel suppression only excludes here
  );

COMMENT ON VIEW nex.food_commercial_universe IS
  'AUTOMATED ACQUISITION-READY businesses (Philip 2026-08-21 · CONSTITUTIONAL). Subset of nex.food_business that has verified contactability + is not suppressed. HQ funnel top-row reports COUNT(discovery_universe) vs COUNT(commercial_universe) + ratio. Do NOT publish "N total businesses" without the paired ratio.';

-- Convenience view · the CURRENT ratio · reported at HQ top
CREATE OR REPLACE VIEW nex.food_universe_ratio AS
SELECT
  (SELECT COUNT(*)::int FROM nex.food_business
   WHERE claim_status IN ('discovered','verifying','listed','invited','claimed','paying'))
    AS discovery_universe,
  (SELECT COUNT(*)::int FROM nex.food_commercial_universe)
    AS commercial_universe,
  (SELECT COUNT(*)::int FROM nex.food_commercial_universe)::numeric /
  NULLIF((SELECT COUNT(*)::int FROM nex.food_business
          WHERE claim_status IN ('listed','invited','claimed','paying')), 0)
    AS commercial_ratio,
  now() AS computed_at;
