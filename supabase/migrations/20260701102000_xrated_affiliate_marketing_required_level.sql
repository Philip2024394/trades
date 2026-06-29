-- Xrated Trades — Affiliate Programme Phase 3 (3/7).
-- Level-gated marketing assets. Assets default to `bronze` so existing
-- rows continue to surface to everyone. Admins can lift a row to silver,
-- gold or platinum from the marketing-pack admin form.

alter table public.hammerex_affiliate_marketing_assets
  add column if not exists required_level text not null default 'bronze'
    check (required_level in ('bronze', 'silver', 'gold', 'platinum'));

create index if not exists hammerex_affiliate_marketing_assets_required_level_idx
  on public.hammerex_affiliate_marketing_assets (required_level);
