-- Trade Center — server-backed marketplace cart.
--
-- Guest visitors write to localStorage only. Signed-in accounts (both
-- trade and DIY roles) sync their cart to this table so the same cart
-- follows them across devices. Merges from localStorage happen once on
-- sign-up via drainGuestBasket().
--
-- Row structure mirrors GuestBasketItem in
-- src/apps/marketplace/lib/useGuestBasket.ts so the client can move
-- items either direction without translation.

CREATE TABLE IF NOT EXISTS app_marketplace_cart_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id     text NOT NULL,
  product_slug   text NOT NULL,
  product_name   text NOT NULL,
  image_url      text,
  qty            integer NOT NULL CHECK (qty > 0),
  unit           text,
  unit_price_gbp numeric(10, 2) NOT NULL CHECK (unit_price_gbp >= 0),
  merchant_slug  text NOT NULL,
  merchant_name  text NOT NULL,
  added_at       timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, product_id)
);

CREATE INDEX IF NOT EXISTS app_marketplace_cart_items_trade_id_idx
  ON app_marketplace_cart_items (trade_id);

-- RLS: owner read + write only.
ALTER TABLE app_marketplace_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_owner_read" ON app_marketplace_cart_items;
CREATE POLICY "cart_items_owner_read"
  ON app_marketplace_cart_items
  FOR SELECT
  USING (auth.uid() = trade_id);

DROP POLICY IF EXISTS "cart_items_owner_write" ON app_marketplace_cart_items;
CREATE POLICY "cart_items_owner_write"
  ON app_marketplace_cart_items
  FOR ALL
  USING (auth.uid() = trade_id)
  WITH CHECK (auth.uid() = trade_id);

COMMENT ON TABLE app_marketplace_cart_items IS
  'Server-backed marketplace cart. One row per (trade_id, product_id). Guest carts stay in localStorage; sign-up drains them into this table via /api/apps/marketplace/cart merge.';
