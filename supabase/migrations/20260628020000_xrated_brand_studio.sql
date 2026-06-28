-- App Studio Brand section — three new columns the trade controls via
-- the App Studio sub-page. CSS variables on the public profile read
-- these so the same studio works for trade-service templates and
-- product-template apps without per-vertical wiring.
--   font_family       short identifier ('system' | 'inter' | 'roboto' |
--                     'lora' | 'playfair' | 'montserrat'). Resolved to
--                     a font-family stack at render time.
--   font_scale        'compact' | 'normal' | 'roomy'. Drives a CSS
--                     multiplier on heading + body sizes.
--   body_text_color   hex string. Default near-black. Overrides the
--                     neutral-900 default on the public profile body.
alter table public.hammerex_trade_off_listings
  add column if not exists font_family text not null default 'system',
  add column if not exists font_scale text not null default 'normal',
  add column if not exists body_text_color text not null default '#0A0A0A';
