-- Xrated Trades — premium-tier feature parity with the kita2 beautician
-- mini-app layout. Adds operating hours, FAQ, service chips, contact-form
-- toggle, and the contact-message inbox the form posts into.

alter table public.hammerex_trade_off_listings
  add column if not exists operating_hours jsonb not null default '{}',
  add column if not exists faq_items jsonb not null default '[]',
  add column if not exists services_offered text[] not null default '{}',
  add column if not exists contact_form_enabled boolean not null default false,
  add column if not exists visit_us_enabled boolean not null default false;

create table if not exists public.hammerex_trade_off_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  sender_name text not null,
  sender_email text not null,
  sender_phone text,
  message text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists hammerex_trade_off_messages_listing_idx
  on public.hammerex_trade_off_messages (listing_id, created_at desc);

alter table public.hammerex_trade_off_messages enable row level security;

-- Customers can POST a message via the contact form (insert only). The
-- listing owner / admin reads them via the service-role client.
drop policy if exists hammerex_trade_off_messages_public_insert
  on public.hammerex_trade_off_messages;
create policy hammerex_trade_off_messages_public_insert
  on public.hammerex_trade_off_messages
  for insert
  to anon, authenticated
  with check (true);
