-- ============================================================================
-- NEX-native Migration 124 · Affiliate Marketplace foundation
-- ============================================================================
--
-- Sealed 2026-10-01 · founder-approved affiliate flow:
--   · Sellers tick "Join NEX Resellers" at onboarding (10% commission)
--   · Opt-in persists as nex_business.reseller_enabled = true
--   · Affiliates browse opted-in sellers at /affiliate/marketplace
--   · Picking "Promote this seller" writes an active row to
--     nex_affiliate_promotion
--   · The affiliate's shop slider surfaces ALL live products from EVERY
--     seller they're currently promoting (no 10-cap on the affiliate
--     side; the seller's own Gratis cap still bounds their total)
--   · Cancelling via "Cancel affiliate link" sets dropped_at = now()
--     so the attribution history survives for the commission ledger
--   · Re-promoting the same seller = a new row (previous dropped row
--     stays as audit trail)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '124';
--     DROP TABLE IF EXISTS nex_affiliate_promotion;
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS reseller_enabled_at,
--       DROP COLUMN IF EXISTS reseller_enabled;
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1) Reseller opt-in flag on nex_business
ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS reseller_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS reseller_enabled_at timestamptz;

COMMENT ON COLUMN nex_business.reseller_enabled IS
  'True when the seller has opted into the NEX Resellers programme (ticked at onboarding or later from /manage/shop). Affiliates can discover + promote this shop via /affiliate/marketplace. Sealed 2026-10-01.';

CREATE INDEX IF NOT EXISTS idx_nex_business_reseller_enabled
  ON nex_business (reseller_enabled_at DESC NULLS LAST)
  WHERE reseller_enabled = true;

-- 2) Affiliate ↔ promoted-seller junction
CREATE TABLE IF NOT EXISTS nex_affiliate_promotion (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_account_id  uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  business_id           uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  started_at            timestamptz NOT NULL DEFAULT now(),
  dropped_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_affiliate_promotion IS
  'One row per (affiliate, promoted seller) pair. dropped_at NULL = currently promoting; non-NULL = stopped. Re-promoting a seller = a new row with the old one left as audit trail. Attribution-ledger rows reference the promotion for context so soft-delete preserves commission history. Sealed 2026-10-01 · Affiliate Marketplace bridge.';

-- Only ONE active promotion per (affiliate, seller) pair · partial
-- unique index skips dropped rows so re-promoting after cancelling
-- never trips the uniqueness constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nex_affiliate_promotion_active
  ON nex_affiliate_promotion (affiliate_account_id, business_id)
  WHERE dropped_at IS NULL;

-- Lookup indexes · affiliate's active list + seller's affiliate roster.
CREATE INDEX IF NOT EXISTS idx_nex_affiliate_promotion_by_affiliate
  ON nex_affiliate_promotion (affiliate_account_id, started_at DESC)
  WHERE dropped_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nex_affiliate_promotion_by_business
  ON nex_affiliate_promotion (business_id, started_at DESC)
  WHERE dropped_at IS NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS nex_affiliate_promotion_touch ON nex_affiliate_promotion;
CREATE TRIGGER nex_affiliate_promotion_touch
  BEFORE UPDATE ON nex_affiliate_promotion
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_affiliate_promotion ENABLE ROW LEVEL SECURITY;

-- The affiliate can read their own rows (any status, so dashboard
-- can show both active and dropped history).
DROP POLICY IF EXISTS nex_affiliate_promotion_self_read ON nex_affiliate_promotion;
CREATE POLICY nex_affiliate_promotion_self_read
  ON nex_affiliate_promotion FOR SELECT
  USING (auth.uid() = affiliate_account_id);

-- Writes (insert / update) are done via service-role server actions
-- which also validate the affiliate owns the row. No direct policies
-- for authenticated INSERT or UPDATE.

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '124',
    'Affiliate Marketplace · nex_business.reseller_enabled + nex_affiliate_promotion junction',
    'Sealed 2026-10-01. Phase 1 of the marketplace flow. Opt-in captured via Launch wizard ResellerOptIn + persisted via createBusinessAction. Affiliates browse opted-in sellers, tap "Promote this seller" → junction row inserts; "Cancel affiliate link" sets dropped_at. Partial unique index guarantees one active promotion per (affiliate, seller) while allowing re-promotion.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='nex_business' AND column_name LIKE 'reseller%';
--   \d nex_affiliate_promotion
--   SELECT count(*) FROM nex_affiliate_promotion;
