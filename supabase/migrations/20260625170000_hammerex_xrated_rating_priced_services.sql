-- Xrated Trades — premium profile spec v2:
--   * rating display (admin-curated until reviews ship)
--   * priced-services carousel: name + image + price + unit

alter table public.hammerex_trade_off_listings
  add column if not exists rating_avg numeric(2,1),
  add column if not exists rating_count integer not null default 0,
  add column if not exists priced_services jsonb not null default '[]',
  add column if not exists promo_text text;

-- priced_services shape: [{name: string, image_url: string|null, price: number, unit: string}]
-- unit examples: "per project", "per m²", "per hour", "per day", "from"
