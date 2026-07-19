-- Extend entity_type enum from 4 → 6 values (Philip 2026-07-16).
--
-- Previous 4: trade, manufacturer, merchant, homeowner.
-- New taxonomy the platform actually needs:
--   • trade             — service provider (plumber, sparks, kitchen fitter)
--   • manufacturer      — makes the product (Hammerex, Marshalltown)
--   • building-supplies — construction-materials merchant (bricks, mortar, ply)
--   • hire-service      — tool + plant hire (mixer, scaffold, machinery)
--   • supplier          — general wholesaler / non-construction-specific retail
--   • homeowner         — personal / DIY account
--
-- `merchant` retained as a legacy alias for pre-migration rows that
-- already committed to it — no automatic remap since we don't know
-- which specific sub-type they should become. Editor UI later
-- prompts the merchant owner to pick a specific sub-type.

begin;

alter table if exists public.hammerex_canteens
  drop constraint if exists hammerex_canteens_entity_type_check;

alter table if exists public.hammerex_canteens
  add constraint hammerex_canteens_entity_type_check
  check (entity_type in (
    'trade',
    'manufacturer',
    'building-supplies',
    'hire-service',
    'supplier',
    'merchant',
    'homeowner'
  ));

alter table if exists public.hammerex_canteen_members
  drop constraint if exists hammerex_canteen_members_entity_type_check;

alter table if exists public.hammerex_canteen_members
  add constraint hammerex_canteen_members_entity_type_check
  check (entity_type in (
    'trade',
    'manufacturer',
    'building-supplies',
    'hire-service',
    'supplier',
    'merchant',
    'homeowner'
  ));

commit;
