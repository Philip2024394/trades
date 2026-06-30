-- Wholesale Mode — Click & Collect pickup window.
--
-- Two nullable TIME columns persist the daily window when customers can
-- collect orders from the merchant's yard. Surfaced as time inputs on
-- the wholesale-mode dashboard (next to Allow Click & Collect) and
-- rendered on the public cart so customers know when to turn up.
-- NULL = "confirm per order over WhatsApp" — keeps the UX honest when
-- the merchant hasn't picked fixed hours.

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS wholesale_pickup_from time NULL,
  ADD COLUMN IF NOT EXISTS wholesale_pickup_to time NULL;

COMMENT ON COLUMN hammerex_trade_off_listings.wholesale_pickup_from IS
  'Earliest time customers can collect orders at the yard. NULL = confirm per order.';
COMMENT ON COLUMN hammerex_trade_off_listings.wholesale_pickup_to IS
  'Latest time customers can collect orders at the yard. NULL = confirm per order.';
