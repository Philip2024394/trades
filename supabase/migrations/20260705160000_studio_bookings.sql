-- Studio Bookings — M3 B7.
--
-- Persists the runtime side of the booking framework:
--   • studio_booking_flows      — which flow slug + policy for a merchant
--   • studio_booking_services   — merchant-authored service catalogue
--   • studio_booking_availability — per-day availability windows
--   • studio_bookings           — customer-submitted bookings
--   • studio_booking_calendar_tokens — OAuth tokens for calendar sync
--
-- Booking flow templates themselves live in code (bookingRegistry) —
-- these tables only record per-merchant configuration + submissions.

set search_path = public;

-- ─── studio_booking_flows ─────────────────────────────────────
create table if not exists studio_booking_flows (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  flow_slug text not null,               -- e.g. "simple-service-booking"
  deposit_policy text not null default 'none' check (deposit_policy in ('none','optional','required')),
  deposit_amount_pence integer,
  cta_label_override text,               -- optional merchant override
  gate text,                             -- 'emergency' | null
  availability_display text not null default 'calendar' check (availability_display in ('calendar','next-available','callback-only','consultation')),
  strategy_snapshot jsonb,               -- ResolvedStrategy at time of publish
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, flow_slug)
);
create index if not exists idx_studio_booking_flows_merchant on studio_booking_flows(merchant_id) where is_active;

-- ─── studio_booking_services ──────────────────────────────────
create table if not exists studio_booking_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  slug text not null,
  label text not null,
  description text,
  duration_minutes integer not null default 60,
  price_from_pence integer,
  price_display_mode text not null default 'from' check (price_display_mode in ('exact','from','hidden')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (merchant_id, slug)
);
create index if not exists idx_studio_booking_services_merchant on studio_booking_services(merchant_id, sort_order);

-- ─── studio_booking_availability ──────────────────────────────
create table if not exists studio_booking_availability (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  starts_at time not null,
  ends_at time not null,
  slot_capacity integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_studio_booking_availability_merchant on studio_booking_availability(merchant_id, weekday) where is_active;

-- ─── studio_bookings ──────────────────────────────────────────
create table if not exists studio_bookings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  flow_slug text not null,
  service_slug text,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_postcode text,
  scheduled_at timestamptz,
  duration_minutes integer,
  payload jsonb not null default '{}'::jsonb,
  strategy_snapshot jsonb,               -- resolved strategy at booking time
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','completed','no-show')),
  deposit_amount_pence integer,
  deposit_paid_at timestamptz,
  deposit_provider text,                 -- 'stripe' | null
  deposit_provider_ref text,
  calendar_synced_at timestamptz,
  calendar_provider text,                -- 'google' | 'outlook' | null
  calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_studio_bookings_merchant_status on studio_bookings(merchant_id, status);
create index if not exists idx_studio_bookings_scheduled on studio_bookings(scheduled_at) where status in ('requested','confirmed');

-- ─── studio_booking_calendar_tokens ───────────────────────────
create table if not exists studio_booking_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  provider text not null check (provider in ('google','outlook')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text,
  scopes text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, provider)
);

-- ─── RLS ──────────────────────────────────────────────────────
alter table studio_booking_flows enable row level security;
alter table studio_booking_services enable row level security;
alter table studio_booking_availability enable row level security;
alter table studio_bookings enable row level security;
alter table studio_booking_calendar_tokens enable row level security;

-- Merchants can read/write their own rows.
drop policy if exists "merchant_owns_booking_flows" on studio_booking_flows;
create policy "merchant_owns_booking_flows"
  on studio_booking_flows
  for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());
drop policy if exists "merchant_owns_booking_services" on studio_booking_services;
create policy "merchant_owns_booking_services"
  on studio_booking_services
  for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());
drop policy if exists "merchant_owns_booking_availability" on studio_booking_availability;
create policy "merchant_owns_booking_availability"
  on studio_booking_availability
  for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());
drop policy if exists "merchant_owns_bookings_read" on studio_bookings;
create policy "merchant_owns_bookings_read"
  on studio_bookings
  for select using (merchant_id = auth.uid());
drop policy if exists "merchant_owns_bookings_write" on studio_bookings;
create policy "merchant_owns_bookings_write"
  on studio_bookings
  for update using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());
-- Anonymous customers can INSERT bookings for any merchant they hit
-- through the public site.
drop policy if exists "public_booking_insert" on studio_bookings;
create policy "public_booking_insert"
  on studio_bookings
  for insert with check (true);
drop policy if exists "merchant_owns_calendar_tokens" on studio_booking_calendar_tokens;
create policy "merchant_owns_calendar_tokens"
  on studio_booking_calendar_tokens
  for all using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());
