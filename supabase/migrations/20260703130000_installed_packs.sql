-- Platform Runtime — installed_packs ledger.
--
-- Per-merchant record of Industry Pack installs. Packs are orchestrated
-- bundles of Apps + brand tokens + starter layout — their reversal
-- semantics live at the pack level (uninstalls the apps it brought
-- in), NOT by joining installed_apps rows.
--
-- Data preservation is default: pack uninstall soft-uninstalls its
-- apps but leaves brand tokens + layouts alone. Merchant customisations
-- of pack-seeded content survive uninstall/reinstall cycles.

create table if not exists public.installed_packs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  pack_slug text not null,
  version text not null,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  -- App slugs installed as part of this pack. Uninstall walks this
  -- list to know which apps to soft-uninstall.
  installed_apps jsonb not null default '[]'::jsonb,
  -- Apps that failed during install. Empty on success. Non-empty
  -- when partial install happened before rollback.
  failed_apps jsonb not null default '[]'::jsonb,
  unique (merchant_id, pack_slug)
);

create index if not exists installed_packs_merchant_active_idx
  on public.installed_packs (merchant_id)
  where uninstalled_at is null;

create index if not exists installed_packs_slug_active_idx
  on public.installed_packs (pack_slug)
  where uninstalled_at is null;
