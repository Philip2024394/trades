-- NEX Merchant Assistant — post-Increment-1 corrections.
--
-- Schema audit 2026-07-27 revealed that the RLS policies shipped in
-- 20260728000000_nex_merchant_assistant.sql reference a `user_id`
-- column that does not exist on hammerex_trade_off_listings. The
-- merchant session model uses HMAC-signed cookies (see
-- src/lib/tradeSession.ts), not Supabase auth.uid(), so the policies
-- always evaluate false and any anon-key merchant read returns nothing.
--
-- All merchant-assistant reads and writes go through server API routes
-- using service-role which bypasses RLS. The application layer
-- (src/lib/nex/merchant-assistant/toolExecutors.ts) re-checks merchant
-- ownership on every tool call — defence-in-depth.
--
-- This migration:
--   1. DROPs the broken merchant-scoped SELECT policies
--   2. Leaves RLS ENABLED with no permissive policies (default deny)
--      so anon-key clients cannot read these tables at all
--   3. Documents the app-layer ownership model

BEGIN;

-- Drop the broken policies (silently succeeds if they don't exist)
DROP POLICY IF EXISTS nex_ma_threads_merchant_select
  ON app_nex_merchant_assistant_threads;
DROP POLICY IF EXISTS nex_ma_messages_merchant_select
  ON app_nex_merchant_assistant_messages;
DROP POLICY IF EXISTS nex_ma_banners_merchant_select
  ON app_nex_merchant_assistant_banners;

-- Table-level comments record the access model for future maintainers
COMMENT ON TABLE app_nex_merchant_assistant_threads IS
  'NEX Merchant Assistant conversation threads. Access via server API '
  'routes only (service-role bypasses RLS). Merchant ownership is '
  're-checked in src/lib/nex/merchant-assistant/toolExecutors.ts on '
  'every tool call. RLS remains ENABLED with no permissive policies '
  'so anon-key clients cannot read these tables directly.';

COMMENT ON TABLE app_nex_merchant_assistant_messages IS
  'NEX Merchant Assistant messages. Same access model as threads.';

COMMENT ON TABLE app_nex_merchant_assistant_banners IS
  'NEX Merchant Assistant banner versions. Same access model as threads.';

-- Rename comment on nex_draft_source columns to reflect the corrected
-- identifier convention (source value is now 'nex_merchant_assistant',
-- not the previous 'merchant_ai_assistant' — the NEX brand rule
-- excludes "AI" from identifiers that propagate through audit logs).
COMMENT ON COLUMN os_products_canonical.nex_draft_source IS
  'Identifier of the NEX flow that created this row as a draft. '
  'Currently one of: ''nex_merchant_assistant'' | null.';

COMMENT ON COLUMN app_products_merchant_offers.nex_draft_source IS
  'Identifier of the NEX flow that created this row as a draft. '
  'Currently one of: ''nex_merchant_assistant'' | null.';

COMMIT;
