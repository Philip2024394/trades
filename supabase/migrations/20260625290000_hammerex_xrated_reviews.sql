-- Xrated Trades — customer reviews + dispute moderation skeleton.
--
-- Reviews post with a 24h cool-down (status=pending → live) so the
-- customer can withdraw if they cooled off. The tradesperson can flag
-- "disputed" with evidence; the badge stays visible while admin
-- reviews. See ContactFormPanel / ReviewForm for the submission flow.

create table if not exists public.hammerex_xrated_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,

  -- Submitter — email kept private, postcode used to verify the job
  -- area; only the first half (outcode) ever renders publicly.
  customer_name text not null,
  customer_email text not null,
  customer_postcode text,

  -- Project context
  project_type text,
  project_finish text,
  timeframe_quoted_days int,
  timeframe_actual_days int,
  attempted_resolution boolean,

  -- Ratings
  overall_rating int not null check (overall_rating between 1 and 5),
  workmanship_rating int check (workmanship_rating between 1 and 5),
  communication_rating int check (communication_rating between 1 and 5),
  value_rating int check (value_rating between 1 and 5),
  timeliness_rating int check (timeliness_rating between 1 and 5),

  body text not null,
  photo_urls text[] not null default '{}'::text[],

  -- Moderation state — pending = within 24h cool-down, live = public,
  -- hidden = admin removed, disputed = tradesperson contested + admin
  -- reviewing, withdrawn = customer withdrew during cool-down.
  status text not null default 'pending'
    check (status in ('pending','live','hidden','disputed','withdrawn')),

  -- Dispute payload — populated by the tradesperson when they flag.
  dispute_reason text,
  dispute_evidence_urls text[] not null default '{}'::text[],
  disputed_at timestamptz,

  -- Tradesperson's public reply (always visible alongside the review).
  public_response text,
  responded_at timestamptz,

  -- Lifecycle timestamps
  submitted_at timestamptz not null default now(),
  goes_live_at timestamptz not null default (now() + interval '24 hours'),
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hammerex_xrated_reviews_listing_status_idx
  on public.hammerex_xrated_reviews (listing_id, status);
create index if not exists hammerex_xrated_reviews_goes_live_idx
  on public.hammerex_xrated_reviews (goes_live_at)
  where status = 'pending';
