-- Xrated Trades — Affiliate Programme Phase 1.
--
-- Self-serve referral programme: anyone can sign up at /affiliates with
-- WhatsApp + password, get a sequential numeric Affiliate ID
-- (100001, 100002, ...), and a permanent referral URL
-- xratedtrade.com/?ref=NNNNN. The middleware drops a 30-day cookie
-- onto every visitor carrying ?ref=N; when that visitor later signs up
-- as a tradesperson via /api/trade-off/create the listing gets stamped
-- with affiliate_referrer_id. When the tradesperson upgrades and pays
-- via Stripe, a £10 commission row is created in
-- hammerex_affiliate_commissions for the originating affiliate.
--
-- All tables are prefixed `hammerex_` per the project-wide namespacing
-- rule. We deliberately use a separate SEQUENCE for the numeric
-- affiliate_id rather than reusing the primary key — UUIDs are not
-- shareable and referral URLs have to fit comfortably in WhatsApp.

create sequence if not exists affiliate_id_seq
  start with 100001 increment by 1;

create table if not exists public.hammerex_affiliates (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null unique default nextval('affiliate_id_seq'),
  whatsapp text not null unique,
  password_hash text not null,
  first_name text,
  last_name text,
  company_name text,
  country text,
  email text,
  website text,
  facebook text,
  instagram text,
  tiktok text,
  youtube text,
  twitter text,
  linkedin text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'banned')),
  payment_details_completed_at timestamptz,
  tax_agreement_accepted_at timestamptz,
  content_agreement_accepted_at timestamptz,
  payment_timing_agreement_accepted_at timestamptz,
  payment_alert_flag boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists hammerex_affiliates_affiliate_id_idx
  on public.hammerex_affiliates (affiliate_id);
create index if not exists hammerex_affiliates_whatsapp_idx
  on public.hammerex_affiliates (whatsapp);

-- Click log. We never join on the UUID — the numeric affiliate_id is
-- carried into every dependent table to keep referral-attribution
-- joins simple and fast.
create table if not exists public.hammerex_affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null,
  ip text,
  country text,
  device text,
  browser text,
  landing_page text,
  referrer_url text,
  created_at timestamptz not null default now(),
  cookie_expires_at timestamptz not null
);
create index if not exists hammerex_affiliate_clicks_affiliate_idx
  on public.hammerex_affiliate_clicks (affiliate_id, created_at desc);

-- A row exists per converted tradesperson. amount_pence is the gross
-- commission; status walks pending → approved (after 14-day cool-off)
-- → paid (after admin marks payout settled). Cancelled / refunded
-- terminal states never become paid.
create table if not exists public.hammerex_affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null,
  listing_id uuid not null,
  stripe_subscription_id text,
  amount_pence integer not null default 1000,
  currency text not null default 'gbp',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'cancelled', 'refunded')),
  approved_at timestamptz,
  paid_at timestamptz,
  paid_method text check (paid_method in ('bank', 'paypal', 'wise', 'manual')),
  paid_reference text,
  cancelled_reason text,
  payout_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists hammerex_affiliate_commissions_affiliate_idx
  on public.hammerex_affiliate_commissions (affiliate_id, status);
create index if not exists hammerex_affiliate_commissions_listing_idx
  on public.hammerex_affiliate_commissions (listing_id);

-- One set of payment details per affiliate. The three agreement
-- timestamps over on hammerex_affiliates are the source of truth for
-- "have they accepted the terms" — these columns just carry the
-- actual bank/paypal/wise destination.
create table if not exists public.hammerex_affiliate_payment_methods (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null unique,
  trading_status text not null
    check (trading_status in ('sole_trader', 'limited_company', 'partnership')),
  legal_name text not null,
  country_iso2 text not null,
  payment_method text not null default 'bank'
    check (payment_method in ('bank', 'paypal', 'wise')),
  bank_account_name text,
  bank_account_number text,
  bank_sort_code text,
  iban text,
  swift_bic text,
  paypal_email text,
  wise_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Monthly payouts — one row per affiliate per period_month. Admin
-- generates these from the queue page once approved commission totals
-- cross the £50 minimum AND payment_details_completed_at is set.
create table if not exists public.hammerex_affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null,
  total_pence integer not null,
  commission_ids uuid[] not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  period_month text not null,
  paid_at timestamptz,
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists hammerex_affiliate_payouts_affiliate_idx
  on public.hammerex_affiliate_payouts (affiliate_id, period_month desc);

-- Affiliate-claimed social link inventory. Phase 2 will add a cron to
-- check each URL for HTTP 404 / removed posts; for now status defaults
-- to 'active' and last_checked_at stays null.
create table if not exists public.hammerex_affiliate_social_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null,
  platform text not null
    check (platform in ('facebook', 'instagram', 'tiktok', 'youtube',
                        'linkedin', 'pinterest', 'x', 'website', 'other')),
  url text not null,
  status text not null default 'active'
    check (status in ('active', 'removed', 'broken')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hammerex_affiliate_social_links_affiliate_idx
  on public.hammerex_affiliate_social_links (affiliate_id);

-- Chronological log of every affiliate-system action — signup, login,
-- payment-details save, commission approve/cancel, payout mark-paid.
-- Surfaces in the /admin/affiliates/audit-log page and per-affiliate
-- detail view.
create table if not exists public.hammerex_affiliate_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null
    check (actor_type in ('affiliate', 'admin', 'system')),
  actor_id text,
  action text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hammerex_affiliate_audit_log_created_idx
  on public.hammerex_affiliate_audit_log (created_at desc);
create index if not exists hammerex_affiliate_audit_log_actor_idx
  on public.hammerex_affiliate_audit_log (actor_type, actor_id);

-- Stamp the referring affiliate (numeric ID) onto each listing the
-- first time we create one with a live ?ref= cookie. NULL = no
-- affiliate.
alter table public.hammerex_trade_off_listings
  add column if not exists affiliate_referrer_id integer;
create index if not exists hammerex_trade_off_listings_affiliate_referrer_idx
  on public.hammerex_trade_off_listings (affiliate_referrer_id)
  where affiliate_referrer_id is not null;
