-- Entity type on canteens + members.
--
-- Purpose (Philip 2026-07-16): the platform hosts four distinct kinds
-- of participant but only tracks the trade CATEGORY (trade_slug =
-- "Building Merchant", "Plumber", etc.). That means Hammerex Direct —
-- a manufacturer — looks identical to a regional builders' merchant
-- because both share the "Building Merchant" trade slug. Buyers can't
-- tell the "buy direct from source" story apart from "buy from a
-- retailer who marks it up."
--
-- Adding entity_type gives every canteen + member a first-class
-- identity dimension:
--   • trade         → service provider (plumber, sparks, kitchen fitter)
--   • manufacturer  → makes the product (Hammerex Direct, Marshalltown)
--   • merchant      → retails others' products (builders' merchant)
--   • homeowner     → personal / DIY account
--
-- CHECK constraint enforces the enum at the DB level so a rogue
-- editor can't insert 'supplier' or 'brand' — the four values are the
-- vocabulary. Adding a fifth needs a coordinated schema change +
-- chip-colour decision.
--
-- Defaults:
--   • Existing canteens → 'trade' (the historical assumption)
--   • hammerex-direct  → 'manufacturer' (only one that isn't a trade)

begin;

alter table if exists public.hammerex_canteens
  add column if not exists entity_type text not null default 'trade';

alter table if exists public.hammerex_canteens
  drop constraint if exists hammerex_canteens_entity_type_check;

alter table if exists public.hammerex_canteens
  add constraint hammerex_canteens_entity_type_check
  check (entity_type in ('trade', 'manufacturer', 'merchant', 'homeowner'));

comment on column public.hammerex_canteens.entity_type
  is 'Participant class — trade (services), manufacturer (makes products), merchant (retails products), homeowner (personal). Independent of trade_slug (the trade category).';

alter table if exists public.hammerex_canteen_members
  add column if not exists entity_type text not null default 'trade';

alter table if exists public.hammerex_canteen_members
  drop constraint if exists hammerex_canteen_members_entity_type_check;

alter table if exists public.hammerex_canteen_members
  add constraint hammerex_canteen_members_entity_type_check
  check (entity_type in ('trade', 'manufacturer', 'merchant', 'homeowner'));

comment on column public.hammerex_canteen_members.entity_type
  is 'Mirrors canteen.entity_type for the admin/host and is per-member for other roles later.';

-- Backfill the only known non-trade canteen.
update public.hammerex_canteens
   set entity_type = 'manufacturer'
 where slug = 'hammerex-direct';

update public.hammerex_canteen_members
   set entity_type = 'manufacturer'
 where member_slug = 'hammerex-direct';

commit;
