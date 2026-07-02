-- Platform Runtime — installed_apps ledger.
--
-- Per-merchant record of every App install. One row per (merchant, app)
-- regardless of install/uninstall cycles — reinstall clears the
-- uninstalled_at timestamp so a merchant returning to an App keeps the
-- history and config they had.
--
-- Data preservation is the default:
--   • Uninstall  — sets uninstalled_at; row stays; created_pages stay
--                  hidden in studio_pages via hidden_at.
--   • Reinstall  — clears uninstalled_at; created_pages unhide.
--   • Purge      — hard DELETE (separate operation; caller decides).
--
-- The row's created_pages array is the authoritative record of which
-- studio_pages slugs this install materialised, so uninstall/purge can
-- reverse the change cleanly.

create table if not exists public.installed_apps (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  app_slug text not null,
  version text not null,
  config_json jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  upgraded_at timestamptz,
  uninstalled_at timestamptz,
  -- Array of studio_pages.slug values this install materialised.
  created_pages jsonb not null default '[]'::jsonb,
  unique (merchant_id, app_slug)
);

-- Fast lookup for "what does this merchant have installed right now?".
create index if not exists installed_apps_merchant_active_idx
  on public.installed_apps (merchant_id)
  where uninstalled_at is null;

-- Powers the App Store's "N merchants use this app" counter without
-- scanning the full table.
create index if not exists installed_apps_slug_active_idx
  on public.installed_apps (app_slug)
  where uninstalled_at is null;

-- Audit / analytics — every install and uninstall event by time.
create index if not exists installed_apps_installed_at_idx
  on public.installed_apps (installed_at desc);
