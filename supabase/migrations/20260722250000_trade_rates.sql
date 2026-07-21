-- Trade rates + regional multipliers.
--
-- Every rate we display to a homeowner has a citable source.
-- DB check constraints ENFORCE this — a row without source_publisher
-- + source_url + last_verified_at cannot exist. Evidence-or-silence
-- rule made structural.
--
-- Trade-agnostic — decorative-rendering first, but the same 2 tables
-- serve concrete, roofing, plumbing, electrical, kitchens, etc.
-- Adding rates for a new trade = insert rows, zero code change.

-- ─── Rates per trade + line item ──────────────────────────────────
create table if not exists hammerex_trade_rates (
  id                    uuid primary key default gen_random_uuid(),
  trade_slug            text not null references hammerex_knowledge_trades(slug) on delete cascade,
  line_item_slug        text not null,
  display_name          text not null,
  description           text,
  unit                  text not null check (unit in ('m2','linear-m','hour','fixed','each','tonne','bag','sheet','day','week')),
  price_low_pence       int  not null check (price_low_pence  >= 0),
  price_high_pence      int  not null check (price_high_pence >= price_low_pence),
  currency              text not null default 'GBP',
  source_publisher      text not null,                                  -- 'Spon''s 2026', 'ONS Q3 2026', 'FMB', 'Checkatrade', 'FPDC'
  source_url            text not null,                                  -- clickable link
  source_reference      text,                                           -- 'page 234' or specific rate ref
  last_verified_at      timestamptz not null default now(),
  applies_to_regions    text[] not null default array['uk'],            -- 'uk' or specific regions
  excludes_notes        text,                                           -- 'supply + basic labour only; scaffolding, beads, prep excluded'
  finish_slug           text,                                           -- optional: 'stone-effect', 'monocouche', for finish-specific rates
  confidence            text not null default 'moderate' check (confidence in ('high','moderate','low')),
  created_at            timestamptz not null default now(),
  unique (trade_slug, line_item_slug)
);

comment on table hammerex_trade_rates is 'Every rate has source_publisher + source_url + last_verified_at REQUIRED. No rate ships to a homeowner without a citation. Rates older than 12mo are auto-flagged in /admin/rates for re-verification.';

create index if not exists idx_trade_rates_trade  on hammerex_trade_rates(trade_slug);
create index if not exists idx_trade_rates_finish on hammerex_trade_rates(finish_slug) where finish_slug is not null;
-- Non-predicated index; freshness filter applied at query time in
-- the /admin/rates page (Postgres needs IMMUTABLE for partial-index
-- WHERE clauses, which now() isn't).
create index if not exists idx_trade_rates_verified on hammerex_trade_rates(last_verified_at);

-- ─── Regional cost multipliers ────────────────────────────────────
create table if not exists hammerex_regional_cost_multipliers (
  region_slug           text primary key,                               -- 'london-se', 'north-west', 'scotland'
  display_name          text not null,
  postcode_prefixes     text[] not null,                                -- ['SW','SE','N','E','W','NW','EC','WC']
  multiplier            numeric(4,3) not null check (multiplier > 0),   -- 1.150 = +15%
  source_publisher      text not null,
  source_url            text not null,
  source_reference      text,
  last_verified_at      timestamptz not null default now(),
  applies_to_trades     text[] not null default array['all'],           -- 'all' or specific trade slugs
  notes                 text,
  created_at            timestamptz not null default now()
);

comment on table hammerex_regional_cost_multipliers is 'Postcode-area cost multipliers vs national average. Same evidence rules — source required. Sourced from ONS Building Cost Index by default.';

-- Postcode-prefix lookup helper — given a UK postcode string,
-- returns the matching region_slug. Simple prefix match.
create or replace function lookup_region_slug(postcode text)
returns text
language sql
stable
as $$
  select region_slug
  from hammerex_regional_cost_multipliers,
       lateral unnest(postcode_prefixes) as pfx
  where postcode is not null
    and upper(regexp_replace(postcode, '\s+', '', 'g')) like upper(pfx) || '%'
  order by length(pfx) desc                                             -- longest prefix wins (e.g. 'EC' beats 'E')
  limit 1
$$;
