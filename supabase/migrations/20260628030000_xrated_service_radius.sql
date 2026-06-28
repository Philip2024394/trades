-- Service-area model — radius in kilometres replaces the freetext
-- postcode list on the signup / edit form. NULL means "all areas" or
-- "not set yet"; any positive integer is the km the tradesperson is
-- willing to travel from their base. The legacy service_postcodes
-- column stays in place so existing listings keep rendering.
alter table public.hammerex_trade_off_listings
  add column if not exists service_radius_km integer;
