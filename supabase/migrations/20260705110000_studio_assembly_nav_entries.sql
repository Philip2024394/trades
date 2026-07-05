-- Studio Assembly Nav Entries — assembly-driven navigation additions.
--
-- The assembly executor writes one row here per `add-nav-item` proposal
-- the merchant accepted. composeNavigation folds these into the tree
-- alongside manifest-declared NavEntries — so a merchant who accepted
-- "add 'Book now' to nav.header" during Bookings install sees the item
-- appear immediately in the composed navigation.
--
-- Design:
--   • Keyed by (brand_id, source_proposal_id) unique so re-executor is
--     idempotent — replaying the same accepted decision updates the row
--     rather than inserting a duplicate.
--   • target_slot mirrors AssemblyAction.target (e.g. "nav.header",
--     "nav.footer"). Consumer decides how to render each slot.
--   • hidden_at is the merchant's soft-hide — they can remove an item
--     from their nav without discarding the assembly decision itself.
--
-- RLS off — matches the rest of the studio_* namespace. Writes go
-- through supabaseAdmin from the assembly executor's server route.

create table if not exists public.studio_assembly_nav_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid not null references public.studio_brands(id) on delete cascade,

  target_slot text not null,
  label text not null,
  href text not null,
  icon text,
  order_index integer not null default 100,

  source_module_id text not null,
  source_proposal_id text not null,
  rationale_snapshot text not null,

  inserted_at timestamptz not null default now(),
  hidden_at timestamptz,

  unique (brand_id, source_proposal_id)
);

create index if not exists studio_assembly_nav_entries_brand_slot_idx
  on public.studio_assembly_nav_entries (brand_id, target_slot)
  where hidden_at is null;

create index if not exists studio_assembly_nav_entries_module_idx
  on public.studio_assembly_nav_entries (brand_id, source_module_id);
