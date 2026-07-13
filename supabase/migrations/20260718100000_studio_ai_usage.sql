-- Studio AI usage ledger — every prompt-to-compose / prompt-to-mutate
-- call gets a row. Powers three things:
--
--   1. Persistent per-merchant rate limiting (replaces in-memory Maps
--      that don't survive dev restarts and can't shard across instances)
--   2. Cost + cache-hit tracking (input/output/cache tokens)
--   3. Support triage — when a merchant says "the AI won't work" we can
--      grep by listing_id and see the last N calls + status codes.
--
-- Retention: no auto-purge yet. When volume climbs, add a nightly
-- delete keeping only the last 30 days of ok rows + all error rows.
--
-- RLS off — all writes are through supabaseAdmin from server routes.

create table if not exists public.studio_ai_usage (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  endpoint text not null check (endpoint in ('compose', 'mutate', 'orchestrate', 'publish')),
  section_id text,
  prompt_snippet text,
  status text not null check (status in ('ok', 'rate_limited', 'error', 'ai_unavailable')),
  error_code text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_creation_tokens int not null default 0,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- Rate-limit query: last-N-minutes count for a listing+endpoint. This
-- index is the hot path — every AI request runs a count over it.
create index if not exists studio_ai_usage_listing_endpoint_created_idx
  on public.studio_ai_usage (listing_id, endpoint, created_at desc);

-- Support-triage query: recent activity for one listing across all
-- endpoints, ordered by time.
create index if not exists studio_ai_usage_listing_created_idx
  on public.studio_ai_usage (listing_id, created_at desc);
