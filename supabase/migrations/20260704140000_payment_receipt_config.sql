-- Receipt configuration per brand.
--
-- Merchants configure the sender identity + branding once; every
-- successful webhook fires a receipt email from these values.

create table if not exists studio_payment_receipt_config (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references studio_brands(id) on delete cascade unique,
  enabled       boolean not null default false,
  from_email    text,                    -- "orders@yourbrand.com"
  from_name     text,                    -- "Xrated Trades"
  logo_url      text,
  reply_to      text,
  footer_note   text,
  bcc_merchant  boolean not null default true,   -- copy the merchant on every receipt
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function studio_receipt_config_touch()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_receipt_config_touch on studio_payment_receipt_config;
create trigger studio_receipt_config_touch
  before update on studio_payment_receipt_config
  for each row execute function studio_receipt_config_touch();

-- Track receipt sends so we don't double-fire on webhook retries.
alter table studio_payment_orders
  add column if not exists receipt_sent_at timestamptz,
  add column if not exists receipt_error text;
