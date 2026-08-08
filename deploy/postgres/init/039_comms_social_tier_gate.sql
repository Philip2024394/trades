-- NEX Comms Centre · Social · Phase 10.1 · Tier gate
--
-- Adds the merchant_slug link that lets the tier gate resolve a Social
-- tenant to its Hammerex listing (hammerex_trade_off_listings.slug), and
-- from there read the merchant's canonical tier.
--
-- Nullable so legacy HQ tenants and any unlinked test tenants stay valid.
-- Enforcement happens in application code (src/lib/nex/comms-social/tier/gate.ts)
-- not in RLS · this column is purely a lookup key.

ALTER TABLE nex.social_tenants
  ADD COLUMN IF NOT EXISTS merchant_slug TEXT;

CREATE INDEX IF NOT EXISTS social_tenants_merchant_slug_idx
  ON nex.social_tenants (merchant_slug)
  WHERE merchant_slug IS NOT NULL;

COMMENT ON COLUMN nex.social_tenants.merchant_slug IS
  'Phase 10.1 · Hammerex trade-off listing slug for tier resolution (hammerex_trade_off_listings.slug) · nullable · set at provision time by matching the auth user email against listings.email';
