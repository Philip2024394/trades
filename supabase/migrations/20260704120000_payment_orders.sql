-- Payment order tracking.
--
-- Every checkout attempt creates a row here. The provider's webhook
-- updates status → paid / failed / cancelled / refunded. Merchants
-- can reconcile via /studio/payments/orders (future).

create table if not exists studio_payment_orders (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references studio_brands(id) on delete cascade,
  provider_id   text not null,               -- 'stripe', 'paypal', 'midtrans', …
  external_ref  text,                        -- provider's session/order id
  order_ref     text,                        -- merchant's own reference
  amount_minor  bigint not null,             -- amount in minor units (cents/paise/etc.)
  currency      text not null,               -- ISO 4217
  description   text,
  status        text not null default 'created',   -- created | pending | paid | failed | cancelled | refunded
  metadata      jsonb not null default '{}'::jsonb,
  customer_email text,
  return_url    text,
  cancel_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_studio_payment_orders_brand
  on studio_payment_orders (brand_id, created_at desc);
create index if not exists idx_studio_payment_orders_external
  on studio_payment_orders (provider_id, external_ref);

create or replace function studio_payment_orders_touch()
returns trigger as $$
begin
  new.updated_at := now();
  if new.status in ('paid', 'failed', 'cancelled', 'refunded') and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_payment_orders_touch on studio_payment_orders;
create trigger studio_payment_orders_touch
  before update on studio_payment_orders
  for each row execute function studio_payment_orders_touch();
