-- Xrated Trades — Affiliate Programme Phase 3 (4/7).
-- Per-affiliate API tokens.
--
-- Each affiliate can mint one or more 40-char random tokens via the
-- dashboard. The token is shown once at creation time; the row is
-- stored as plain text (random 40-char tokens are computationally
-- unguessable; bcrypt overhead is not worth the user-experience cost
-- here). Tokens auth against /api/v1/affiliates/me via
-- `Authorization: Bearer <token>`.
--
-- revoked_at is the soft-delete marker; revoked tokens stay in the
-- table for audit but always fail auth.

create table if not exists public.hammerex_affiliate_api_tokens (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null,
  token text not null unique,
  label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists hammerex_affiliate_api_tokens_affiliate_idx
  on public.hammerex_affiliate_api_tokens (affiliate_id, created_at desc);
create index if not exists hammerex_affiliate_api_tokens_active_idx
  on public.hammerex_affiliate_api_tokens (token)
  where revoked_at is null;
