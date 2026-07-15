-- Rename app_marketplace_cart_items → app_tradecenter_cart_items.
--
-- Matches the internal engine rename (src/apps/marketplace →
-- src/apps/tradecenter) so table names carry the same brand as the
-- code and the URL the users see (/tc/trade-center).
--
-- Idempotent — safe to re-run.

alter table if exists public.app_marketplace_cart_items
  rename to app_tradecenter_cart_items;
