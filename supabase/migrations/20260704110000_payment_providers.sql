-- Payment provider configuration per brand.
--
-- One row per (brand, provider). Credentials stored in a JSONB column
-- protected by RLS. Sensitive keys (secret_key, private_key, api_key)
-- MUST be write-only from the app layer — never read back through the
-- Studio API. Read-back returns a masked stub; the underlying value
-- stays in the DB until a payment processor call happens server-side.

create table if not exists studio_payment_providers (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references studio_brands(id) on delete cascade,
  provider_id   text not null,             -- 'stripe', 'paypal', 'wise', …
  enabled       boolean not null default false,
  credentials   jsonb not null default '{}'::jsonb,   -- write-only from the app layer
  last_tested_at timestamptz,
  last_test_ok  boolean,
  last_test_error text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (brand_id, provider_id)
);

create index if not exists idx_studio_payment_providers_brand
  on studio_payment_providers (brand_id);

create or replace function studio_payment_providers_touch()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_payment_providers_touch on studio_payment_providers;
create trigger studio_payment_providers_touch
  before update on studio_payment_providers
  for each row execute function studio_payment_providers_touch();
