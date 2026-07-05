-- Storm-mode banner.
--
-- One row per brand. Merchant toggles it on when weather / traffic /
-- other event affects service — the public site auto-lights a banner
-- with the custom message and honest response window. Auto-expires so
-- a merchant can't leave a stale storm banner up when the sun's out.
--
-- Kept honest: no automatic Met Office scraping. UK Met Office DataHub
-- is paid; scraping the consumer-facing warning feed is fragile and
-- against T&Cs. Manual toggle keeps this reliable + compliant.

create table if not exists public.studio_brand_storm_mode (
  brand_id     uuid primary key references public.studio_brands(id) on delete cascade,
  enabled      boolean not null default false,
  message      text,
  cta_label    text,
  cta_href     text,
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);

create or replace function public.studio_brand_storm_mode_touch()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_brand_storm_mode_touch on public.studio_brand_storm_mode;
create trigger studio_brand_storm_mode_touch
  before update on public.studio_brand_storm_mode
  for each row execute function public.studio_brand_storm_mode_touch();
