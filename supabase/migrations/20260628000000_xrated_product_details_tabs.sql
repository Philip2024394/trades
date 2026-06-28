-- Xrated Trades — PDP details tabs.
--
-- Adds three optional columns to hammerex_xrated_products to power the
-- new tabbed details panel (Description / Specs / Features / Ref / Video)
-- on the public PDP. All three are nullable; existing rows are not
-- back-filled. The PDP renders a tab only when the underlying column
-- has data (Description + Ref are always shown).
--
-- specs  jsonb   — array of {label, value} rows
-- features jsonb — array of bullet strings
-- video_url text — YouTube link (watch?v= / youtu.be/ / embed/)

alter table public.hammerex_xrated_products
  add column if not exists specs jsonb null,
  add column if not exists features jsonb null,
  add column if not exists video_url text null;

-- Keep the jsonb columns shaped as arrays so the API doesn't have to
-- defend against object payloads at every read site. CHECKs are added
-- conditionally so re-running this migration on environments where
-- the constraint already exists is a no-op.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_xrated_specs_array') then
    alter table public.hammerex_xrated_products
      add constraint chk_xrated_specs_array
      check (specs is null or jsonb_typeof(specs) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_xrated_features_array') then
    alter table public.hammerex_xrated_products
      add constraint chk_xrated_features_array
      check (features is null or jsonb_typeof(features) = 'array');
  end if;
end $$;

comment on column public.hammerex_xrated_products.specs is
  'Array of {label, value} rows. Powers the Specs tab on the PDP. NULL = no specs.';
comment on column public.hammerex_xrated_products.features is
  'Array of bullet strings. Powers the Features tab on the PDP. NULL = no features.';
comment on column public.hammerex_xrated_products.video_url is
  'YouTube link (watch?v=, youtu.be/, or embed/). Powers the Video tab on the PDP.';
