-- Merchant Pro — per-product free-delivery qualifier.
--
-- A merchant on building-merchant / builders-supplies picks specific
-- products from their catalogue that ship FREE within their stated
-- wholesale delivery zones when the customer orders at least
-- `free_delivery_min_qty`. NULL = no free-delivery offer for this
-- product (default). When set, the product card + PDP render a yellow
-- "Free Delivery on X+ orders" badge, and the cart logic short-circuits
-- to zero delivery cost for any order containing at least one qualifying
-- line item (whole-order free delivery — chosen for simpler UX and to
-- drive larger basket sizes; see project_xratedtrade_merchant_pro.md).

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS free_delivery_min_qty integer NULL;

ALTER TABLE hammerex_xrated_products
  ADD CONSTRAINT chk_free_delivery_min_qty_positive
  CHECK (free_delivery_min_qty IS NULL OR free_delivery_min_qty > 0);

COMMENT ON COLUMN hammerex_xrated_products.free_delivery_min_qty IS
  'Min quantity that unlocks free delivery for this product (within the merchant''s wholesale zones). NULL = no free-delivery offer. Triggers the Free Delivery badge on the product card + PDP and zeroes the order delivery cost.';
