-- Extend hammerex_canteen_products for full-fidelity Hammerex
-- product migration.
--
-- Rationale (Philip 2026-07-16): Hammerexdirect.com is being folded
-- into Networkers as a merchant canteen. Product data must round-trip
-- without loss. Networkers canteen products already have most of the
-- shape (variants, commerce, gallery, currency) but are missing three
-- Hammerex-specific fields:
--
--   1. ref              — SKU / Ref number ("Ref: HX-LB2-001"). Surfaces
--                         on PDP, cart, WhatsApp per user rule
--                         (feedback_hammerex_ref_number.md). Nullable
--                         so existing canteen products stay valid.
--
--   2. price_idr        — Hammerex canonical currency. Kept alongside
--                         price_gbp so a product can display both
--                         (project_hammerex_pricing_fx.md — IDR is the
--                         chargeable price; GBP is indicative for UK
--                         buyers). Nullable so non-Hammerex products
--                         remain GBP-only.
--
--   3. addon_bundle     — Deal Breaker upsells. Array of add-on refs
--                         and deal prices. Renders as the yellow
--                         accent card on PDP per
--                         project_hammerex_deal_breaker.md. Shape:
--                         [{ productId, dealPriceGbp, dealPriceIdr?,
--                            label? }].
--                         Nullable — most products won't have upsells.
--
-- Every column is nullable / has a safe default so the migration is
-- non-breaking for the 3 canteens that already have live products.
--
-- Extends the platform (per project_extend_dont_duplicate_permanent_rule.md)
-- rather than adding Hammerex-scoped tables. Any future merchant with
-- SKUs, dual-currency pricing, or add-on bundles benefits.

begin;

alter table if exists public.hammerex_canteen_products
  -- Merchant-visible SKU / Ref. Rendered as "Ref: X" on every surface
  -- (PDP, cart, WhatsApp share, checkout). Not enforced unique because
  -- refs are per-merchant scope — two merchants could legitimately use
  -- the same code.
  add column if not exists ref text,
  -- Hammerex canonical IDR price. When present, PDP renders IDR
  -- alongside GBP. When null, only GBP shows.
  add column if not exists price_idr bigint,
  -- Deal Breaker add-on bundle. Array of {productId, dealPriceGbp,
  -- dealPriceIdr?, label?}. Renders as an inline upsell card on PDP.
  -- Products referenced here must exist in hammerex_canteen_products
  -- under the same canteen — not enforced by FK because JSONB arrays
  -- can't be constrained; enforced by the editor UI on save.
  add column if not exists addon_bundle jsonb;

-- Index for the "products with SKU" admin lookup — used by the
-- migration review queue and the "find by ref" search.
create index if not exists hammerex_canteen_products_ref
  on public.hammerex_canteen_products (canteen_id, ref)
  where ref is not null;

comment on column public.hammerex_canteen_products.ref
  is 'Merchant SKU / Ref number. Rendered as "Ref: X" on PDP/cart/WhatsApp. Per-merchant unique, not globally unique.';
comment on column public.hammerex_canteen_products.price_idr
  is 'Canonical price in IDR when the merchant sells in a non-GBP base currency (Hammerex, Indonesia-linked stock). GBP price is indicative for UK-side display.';
comment on column public.hammerex_canteen_products.addon_bundle
  is 'Deal Breaker upsells. JSONB array of {productId, dealPriceGbp, dealPriceIdr?, label?}. Referenced product IDs must live under the same canteen.';

commit;
