-- NEX Merchant contact preferences.
--
-- Per the Phase 7 contact & membership architecture (2026-07-27):
-- merchants control which contact channels appear on their NEX Centre
-- product cards. Presence of an email/phone/website value alone is
-- NOT enough to make it public — the merchant must explicitly opt in.
--
-- Defaults:
--   nex_show_whatsapp  true   (channel merchants already use to receive leads)
--   nex_show_email     true   (already surfaced via mailto: on the cards)
--   nex_show_website   true   (public marketing surface — safe default)
--   nex_show_phone     false  (privacy default — many tradies do not want
--                              their mobile on public listings)
--
-- Additive-only migration. Safe to re-run.

BEGIN;

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS nex_show_whatsapp BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nex_show_email    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nex_show_website  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nex_show_phone    BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN hammerex_trade_off_listings.nex_show_whatsapp IS
  'Merchant opt-in to display the WhatsApp contact button on NEX Centre '
  'product cards. Default true — existing merchants who already have '
  'WhatsApp on file get the channel automatically.';

COMMENT ON COLUMN hammerex_trade_off_listings.nex_show_email IS
  'Merchant opt-in to display the Email contact button on NEX Centre '
  'product cards. Default true.';

COMMENT ON COLUMN hammerex_trade_off_listings.nex_show_website IS
  'Merchant opt-in to display the Website link on NEX Centre product '
  'cards. Default true — a website is a public marketing surface.';

COMMENT ON COLUMN hammerex_trade_off_listings.nex_show_phone IS
  'Merchant opt-in to display the Phone number on NEX Centre product '
  'cards. Default FALSE — merchant must explicitly enable. Many tradies '
  'do not want their mobile number on public discovery surfaces.';

COMMIT;
