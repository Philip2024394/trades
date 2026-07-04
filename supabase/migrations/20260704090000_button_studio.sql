-- Xrated Button Studio — persistence.
--
-- Three tables:
--   studio_global_buttons   Per-brand button globals (primary, secondary, …)
--                           bound instances inherit + local overrides apply
--   studio_saved_buttons    Merchant's personal button library
--   studio_button_events    Telemetry — view/hover/focus/click/success/error
--
-- All three carry brand_id and cascade with the brand. No foreign key
-- into studio_pages — buttons live inside section instances which are
-- inside layout_json, so `page_id` is a soft column for filtering
-- events by page.

create table if not exists studio_global_buttons (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references studio_brands(id) on delete cascade,
  role          text not null,             -- 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'cta'
  variant_key   text not null,             -- e.g. 'primary.solid_1'
  config_json   jsonb not null default '{}'::jsonb,
  states_json   jsonb not null default '{}'::jsonb,
  motion_json   jsonb not null default '{}'::jsonb,
  shape_json    jsonb not null default '{}'::jsonb,
  size          text,
  version       int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (brand_id, role)
);

create index if not exists idx_studio_global_buttons_brand
  on studio_global_buttons (brand_id);

create table if not exists studio_saved_buttons (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null,
  brand_id      uuid not null references studio_brands(id) on delete cascade,
  name          text not null,
  role          text not null,
  variant_key   text not null,
  config_json   jsonb not null,
  states_json   jsonb not null default '{}'::jsonb,
  motion_json   jsonb not null default '{}'::jsonb,
  shape_json    jsonb not null default '{}'::jsonb,
  usage_count   int not null default 0,
  thumbnail_url text,
  scope         text not null default 'personal',   -- personal | team | published
  created_at    timestamptz not null default now()
);

create index if not exists idx_studio_saved_buttons_brand
  on studio_saved_buttons (brand_id, created_at desc);

create table if not exists studio_button_events (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null,
  brand_id      uuid not null,
  page_id       uuid,
  instance_id   text not null,
  role          text not null,
  variant_key   text not null,
  event         text not null,          -- view | hover | focus | click | success | error
  breakpoint    text,
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);

create index if not exists idx_studio_button_events_page
  on studio_button_events (page_id, occurred_at desc);
create index if not exists idx_studio_button_events_role
  on studio_button_events (role, event, occurred_at desc);
create index if not exists idx_studio_button_events_variant
  on studio_button_events (variant_key, occurred_at desc);

-- updated_at trigger for global buttons so callers can rely on it.
create or replace function studio_global_buttons_touch()
returns trigger as $$
begin
  new.updated_at := now();
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_global_buttons_touch on studio_global_buttons;
create trigger studio_global_buttons_touch
  before update on studio_global_buttons
  for each row execute function studio_global_buttons_touch();
