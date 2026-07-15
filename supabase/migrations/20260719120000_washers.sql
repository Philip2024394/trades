-- Washer lead-gen model — the three tables that back the verified
-- WhatsApp contact economy. See project_washers_lead_gen_model.md and
-- the code paths under src/app/api/washers/* for the runtime.
--
-- Design constraints:
--   * Balance is per-listing (each merchant has ONE bag). Signup grant
--     is 10 washers, one-off. Refill packs credit; verified sends
--     debit.
--   * Every credit/debit writes a transactions row for audit + admin
--     forensics. The bag balance is the source of truth for the API,
--     but the transactions log lets us reconstruct at any point.
--   * Spam-flag rows land in the admin red zone. Approving a flag
--     refunds the washer AND appends a refund transaction so the
--     bag balance matches the log.
--   * 30-day idempotency (same guest phone → same merchant → 1
--     washer) is enforced by the deduct API reading recent
--     transactions before writing a new one.
--
-- All tables mirror the platform's `hammerex_` prefix convention so
-- they slot into the existing supabaseAdmin queries.

-- ─── 1. Bag (one row per merchant listing) ─────────────────
create table if not exists public.hammerex_washer_bag (
  listing_id       uuid primary key
                   references public.hammerex_trade_off_listings(id)
                   on delete cascade,
  balance          integer     not null default 0
                   check (balance >= 0),
  auto_topup       boolean     not null default true,
  auto_topup_pack  text        not null default 'medium'
                   check (auto_topup_pack in ('small', 'medium', 'large')),
  auto_topup_threshold integer not null default 5
                   check (auto_topup_threshold >= 0),
  signup_grant_awarded boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.hammerex_washer_bag is
  'One row per merchant listing. Balance = washers available to spend on verified WA leads.';
comment on column public.hammerex_washer_bag.signup_grant_awarded is
  'One-off signup grant flag (10 free washers). Never resets — even if the merchant deletes and re-signs up we do not re-award.';

-- ─── 2. Transactions log (audit trail) ─────────────────────
create table if not exists public.hammerex_washer_transactions (
  id           uuid        primary key default gen_random_uuid(),
  listing_id   uuid        not null
               references public.hammerex_trade_off_listings(id)
               on delete cascade,
  kind         text        not null
               check (kind in ('grant', 'deduct', 'purchase', 'refund', 'idempotent-skip')),
  delta        integer     not null,
  balance_after integer    not null,
  source       text        not null,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_hammerex_washer_transactions_listing_created
  on public.hammerex_washer_transactions(listing_id, created_at desc);

create index if not exists idx_hammerex_washer_transactions_kind
  on public.hammerex_washer_transactions(kind);

comment on table public.hammerex_washer_transactions is
  'Immutable log of every washer movement. Bag balance is the running sum; this table lets us reconstruct + audit.';
comment on column public.hammerex_washer_transactions.detail is
  'Free-form JSON. For deducts: guest_phone_hash, guest_name, source_surface, source_label, request_id. For purchases: stripe_session_id, pack_id.';

-- ─── 3. Spam flags (admin red zone queue) ──────────────────
create table if not exists public.hammerex_washer_spam_flags (
  id                  uuid        primary key default gen_random_uuid(),
  listing_id          uuid        not null
                      references public.hammerex_trade_off_listings(id)
                      on delete cascade,
  transaction_id      uuid        not null
                      references public.hammerex_washer_transactions(id)
                      on delete cascade,
  merchant_reason     text        not null,
  guest_phone_hash    text,
  status              text        not null default 'pending'
                      check (status in ('pending', 'approved', 'denied')),
  admin_note          text,
  resolved_by         text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_hammerex_washer_spam_flags_status
  on public.hammerex_washer_spam_flags(status, created_at desc);

comment on table public.hammerex_washer_spam_flags is
  'Merchant-submitted refund requests. Populates /admin/red-zone. When status=approved, the refund transaction is appended and bag balance updated.';

-- ─── RLS: locked down. Only supabaseAdmin (service role) touches
-- these tables. Merchant-facing reads route through the API. ────
alter table public.hammerex_washer_bag           enable row level security;
alter table public.hammerex_washer_transactions  enable row level security;
alter table public.hammerex_washer_spam_flags    enable row level security;
-- No policies added → service role (used by supabaseAdmin) still has
-- full access; every other role is blocked. Matches the existing
-- pattern for merchant-sensitive tables in this codebase.

-- ─── updated_at trigger for the bag row ────────────────────
create or replace function public.hammerex_washer_bag_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_hammerex_washer_bag_touch on public.hammerex_washer_bag;
create trigger trg_hammerex_washer_bag_touch
before update on public.hammerex_washer_bag
for each row execute function public.hammerex_washer_bag_touch_updated_at();
