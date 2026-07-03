-- app_submissions
--
-- User-generated App ideas from the Studio home "Describe your app"
-- recommender. Captured when the AI recommender returns zero matches
-- OR the merchant explicitly rejects all matches and clicks
-- "Submit as new App idea".
--
-- Flow:
--   awaiting_review → (admin approves + builds)   → approved → live
--                   → (admin rejects with a note) → rejected
--
-- Ownership: per the platform terms, materials generated from
-- submissions become property of xratedtrade.com. The submitter is
-- tracked for credit / notification only.

create table if not exists app_submissions (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references merchants(id) on delete cascade,
  brand_id         uuid null references brands(id) on delete set null,
  -- The raw merchant description, verbatim.
  description      text not null,
  -- The AI recommender's suggested slug at submission time, if any.
  -- Helps admins see why the recommender didn't match.
  ai_top_slug      text null,
  ai_confidence    numeric null,
  status           text not null default 'awaiting_review'
                     check (status in ('awaiting_review','approved','rejected','live')),
  admin_notes      text null,
  approved_slug    text null,  -- the slug shipped, if admin builds it
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  reviewed_at      timestamptz null
);

create index if not exists app_submissions_merchant_idx
  on app_submissions(merchant_id, created_at desc);
create index if not exists app_submissions_status_idx
  on app_submissions(status, created_at desc);

-- Row-level security: merchants see their own; service role sees all.
alter table app_submissions enable row level security;

drop policy if exists app_submissions_owner_read on app_submissions;
create policy app_submissions_owner_read
  on app_submissions
  for select
  using (merchant_id = auth.uid());

drop policy if exists app_submissions_owner_insert on app_submissions;
create policy app_submissions_owner_insert
  on app_submissions
  for insert
  with check (merchant_id = auth.uid());

-- Admin service role writes via bypass; no explicit admin policy needed.

comment on table app_submissions is
  'Merchant-submitted App ideas from Studio home recommender. Admin review queue.';
