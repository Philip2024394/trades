-- ============================================================================
-- NEX-native Migration 087 · Bridge 49a · NEX Direct Price · ladder + progress
-- ============================================================================
--
-- Founder-sealed doctrine 2026-09-29: vouchers retired · replaced by a
-- three-part system that lives INSIDE the product card:
--
--   1. LOYALTY LADDER    · discount rises with order count · per shop.
--   2. SHARE-TO-EARN     · sharing to NEX contacts (friends or groups)
--                          unlocks +5% for sharer + +5% for receiver
--                          (friend) or +7% both sides (group) for 48hr.
--                          SHARING IS NEX-INTERNAL ONLY · never external
--                          (no WhatsApp / Instagram device share sheet).
--   3. COMPARE PRICE     · every product surfaces "you save Rp X vs
--                          typical delivery app" so the shopper sees the
--                          real value of NEX's flat 99k/mo pricing vs
--                          GoFood's 20-25% commission.
--
-- Adds:
--
--   nex_product_ladder            · one row per business · JSONB tiers
--                                    array + max cap + share bonuses.
--   nex_buyer_tier_progress       · one row per (buyer × business) ·
--                                    tracks order count for ladder.
--   nex_business.compare_markup_pct · default markup used to compute
--                                    the "typical delivery app" price ·
--                                    22% mirrors GoFood's approximate
--                                    per-order commission.
--
-- Not this migration · deferred to Bridge 49b:
--   nex_product_share_grant · per-share record tracking sharer/receiver
--                              + expiry + consumption · needed to
--                              actually apply the +5/+7% at checkout.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '087';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS compare_markup_pct;
--     DROP TABLE IF EXISTS nex_buyer_tier_progress;
--     DROP TABLE IF EXISTS nex_product_ladder;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nex_product_ladder · one row per business
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_product_ladder (
  business_id             uuid PRIMARY KEY REFERENCES nex_business(id) ON DELETE CASCADE,
  tiers                   jsonb NOT NULL DEFAULT
    '[{"order":1,"discount":0,"label":"New here"},
      {"order":2,"discount":3,"label":"Getting to know us"},
      {"order":4,"discount":5,"label":"Regular"},
      {"order":7,"discount":8,"label":"We know your order"},
      {"order":12,"discount":15,"label":"Member for life"}]'::jsonb,
  max_cap_pct             integer NOT NULL DEFAULT 15
    CHECK (max_cap_pct BETWEEN 0 AND 25),
  share_friend_bonus_pct  integer NOT NULL DEFAULT 5
    CHECK (share_friend_bonus_pct BETWEEN 0 AND 15),
  share_group_bonus_pct   integer NOT NULL DEFAULT 7
    CHECK (share_group_bonus_pct BETWEEN 0 AND 20),
  share_expiry_hours      integer NOT NULL DEFAULT 48
    CHECK (share_expiry_hours BETWEEN 1 AND 168),
  compare_channel         text NOT NULL DEFAULT 'typical delivery app'
    CHECK (length(trim(compare_channel)) BETWEEN 1 AND 60),
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_product_ladder IS
  'Per-business config for the NEX Direct Price system · loyalty ladder + share bonuses + compare channel · Bridge 49a sealed 2026-09-29.';

COMMENT ON COLUMN nex_product_ladder.tiers IS
  'JSONB array of {order:int, discount:int, label:text} · order is the buyer order-count milestone · discount is the applied % off at that tier · label is a short human string. Defaults ship the Founder-approved 5-tier ladder.';

COMMENT ON COLUMN nex_product_ladder.max_cap_pct IS
  'Ceiling on total stacked discount (tier + share). Restaurants safe at 15 (still beats GoFood 20-25% commission). Product sellers may cap lower (Shopee/Tokopedia only take 3-8%).';

COMMENT ON COLUMN nex_product_ladder.share_friend_bonus_pct IS
  'Bonus applied to BOTH sharer and receiver when a product is shared to a NEX peer (friend). Never external · doctrine: NEX chat is the sharing rail.';

COMMENT ON COLUMN nex_product_ladder.share_group_bonus_pct IS
  'Bonus applied to sharer and every group member when a product is shared to a NEX group chat. Never external.';

COMMENT ON COLUMN nex_product_ladder.share_expiry_hours IS
  'Reward window · sharer + receivers must place their order within this many hours or the bonus lapses.';

COMMENT ON COLUMN nex_product_ladder.compare_channel IS
  'Label used in "you save Rp X vs {compare_channel}" copy on every product · legally safer than naming Gojek/GrabFood directly.';

CREATE OR REPLACE FUNCTION nex_touch_product_ladder_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_product_ladder_updated_at ON nex_product_ladder;
CREATE TRIGGER trg_nex_product_ladder_updated_at
  BEFORE UPDATE ON nex_product_ladder
  FOR EACH ROW EXECUTE FUNCTION nex_touch_product_ladder_updated_at();

ALTER TABLE nex_product_ladder ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_product_ladder_public_read
  ON nex_product_ladder
  FOR SELECT
  USING (active = true);
COMMENT ON POLICY nex_product_ladder_public_read ON nex_product_ladder IS
  'Buyers of any authenticated status can read active ladder configs so the product page can render the tier ladder + share offers + compare price.';

-- ---------------------------------------------------------------------------
-- 2. nex_buyer_tier_progress · per (buyer × business)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_buyer_tier_progress (
  buyer_account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  business_id        uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  order_count        integer NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  last_order_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_account_id, business_id)
);

COMMENT ON TABLE nex_buyer_tier_progress IS
  'Tracks how many orders a buyer has placed with each business · drives the loyalty-ladder discount displayed on the product page. Bridge 49a sealed 2026-09-29.';

CREATE INDEX IF NOT EXISTS idx_nex_buyer_tier_progress_business
  ON nex_buyer_tier_progress (business_id, order_count DESC);

CREATE OR REPLACE FUNCTION nex_touch_buyer_tier_progress_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_buyer_tier_progress_updated_at ON nex_buyer_tier_progress;
CREATE TRIGGER trg_nex_buyer_tier_progress_updated_at
  BEFORE UPDATE ON nex_buyer_tier_progress
  FOR EACH ROW EXECUTE FUNCTION nex_touch_buyer_tier_progress_updated_at();

ALTER TABLE nex_buyer_tier_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_buyer_tier_progress_self_read
  ON nex_buyer_tier_progress
  FOR SELECT
  USING (
    buyer_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );
COMMENT ON POLICY nex_buyer_tier_progress_self_read ON nex_buyer_tier_progress IS
  'Buyer reads only their own progress row · sellers cannot see individual buyer counts (aggregate stats go through service role).';

-- ---------------------------------------------------------------------------
-- 3. nex_business.compare_markup_pct · default markup for the compare line
-- ---------------------------------------------------------------------------
ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS compare_markup_pct integer NOT NULL DEFAULT 22
    CHECK (compare_markup_pct BETWEEN 0 AND 60);

COMMENT ON COLUMN nex_business.compare_markup_pct IS
  'Default markup % used to derive the "typical delivery app" comparison price on every product ({price} × (1 + markup/100)). Defaults to 22 mirroring approximate GoFood commission. Restaurants can raise (GrabFood is often higher) or lower (Shopee is ~6%). Sealed 2026-09-29 · Bridge 49a.';

-- ---------------------------------------------------------------------------
-- 4. Record this migration
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '087',
    'Bridge 49a · NEX Direct Price · ladder + buyer progress + compare markup',
    'Founder-authorised 2026-09-29. Retires the voucher concept · introduces per-shop loyalty ladder, per-buyer tier progress, per-business compare markup. Share-to-earn stays NEX-internal only (peer chats + groups) · never external device share sheet · doctrine: NEX chat is the sharing rail.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name IN ('nex_product_ladder','nex_buyer_tier_progress','nex_business')
--      AND column_name IN ('tiers','max_cap_pct','order_count','compare_markup_pct')
--    ORDER BY table_name, column_name;
