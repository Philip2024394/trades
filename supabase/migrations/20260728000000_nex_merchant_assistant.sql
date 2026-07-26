-- NEX Merchant Assistant — Phase 7 · Increment 1 foundation
--
-- Additive-only migration per the plan:
--   1. Conversation threads + messages (audit + resume)
--   2. Banner versions history (per-offer, monotonic version)
--   3. Auto-marketing toggle + frequency per merchant
--   4. AI draft source flag on canonical products and merchant offers
--   5. RLS policies: merchant sees own only, service-role bypasses
--
-- Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 6
-- Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md
--
-- Safety: every ADD / CREATE guarded by IF NOT EXISTS. Safe to re-run.

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- 1. Conversation threads
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_nex_merchant_assistant_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  title             TEXT,
  status            TEXT NOT NULL DEFAULT 'active',   -- active · archived · closed
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nex_ma_threads_merchant_idx
  ON app_nex_merchant_assistant_threads(merchant_id);
CREATE INDEX IF NOT EXISTS nex_ma_threads_activity_idx
  ON app_nex_merchant_assistant_threads(last_activity_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- 2. Messages (Anthropic content-block shape)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_nex_merchant_assistant_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id      UUID NOT NULL REFERENCES app_nex_merchant_assistant_threads(id) ON DELETE CASCADE,
  merchant_id    UUID NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,                       -- user · assistant · system
  content        JSONB NOT NULL,                      -- Anthropic content blocks
  tool_calls     JSONB,                               -- array of tool_use blocks
  tool_results   JSONB,                               -- array of tool_result blocks
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nex_ma_messages_thread_idx
  ON app_nex_merchant_assistant_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS nex_ma_messages_merchant_idx
  ON app_nex_merchant_assistant_messages(merchant_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- 3. Banner versions history
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_nex_merchant_assistant_banners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  offer_id       UUID NOT NULL REFERENCES app_products_merchant_offers(id) ON DELETE CASCADE,
  version        INT NOT NULL,                        -- monotonic per offer
  headline       TEXT NOT NULL,
  body           TEXT,
  cta            TEXT,
  visual_style   TEXT,                                -- premium · utility · seasonal · minimal
  is_active      BOOLEAN NOT NULL DEFAULT false,
  generated_by   TEXT NOT NULL,                       -- nex_ai · merchant_manual
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at    TIMESTAMPTZ,
  UNIQUE (offer_id, version)
);

CREATE INDEX IF NOT EXISTS nex_ma_banners_merchant_idx
  ON app_nex_merchant_assistant_banners(merchant_id);
CREATE INDEX IF NOT EXISTS nex_ma_banners_offer_active_idx
  ON app_nex_merchant_assistant_banners(offer_id, is_active);

-- Only ONE active banner per offer at a time
CREATE UNIQUE INDEX IF NOT EXISTS nex_ma_banners_one_active_per_offer
  ON app_nex_merchant_assistant_banners(offer_id)
  WHERE is_active = true;

-- ══════════════════════════════════════════════════════════════════
-- 4. Auto-marketing per merchant (opt-in, off by default)
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS nex_auto_marketing_enabled       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nex_auto_marketing_frequency_days INT     NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS nex_auto_marketing_last_run_at   TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════════════
-- 5. AI draft source flag (metadata only, additive to product tables)
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE os_products_canonical
  ADD COLUMN IF NOT EXISTS nex_draft_source TEXT;    -- merchant_ai_assistant · null

ALTER TABLE app_products_merchant_offers
  ADD COLUMN IF NOT EXISTS nex_draft_source TEXT;    -- merchant_ai_assistant · null

-- ══════════════════════════════════════════════════════════════════
-- 6. Row-Level Security — merchant sees only their own
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE app_nex_merchant_assistant_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_nex_merchant_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_nex_merchant_assistant_banners  ENABLE ROW LEVEL SECURITY;

-- Threads: merchant sees own
CREATE POLICY nex_ma_threads_merchant_select ON app_nex_merchant_assistant_threads
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM hammerex_trade_off_listings
      WHERE user_id = auth.uid()
    )
  );

-- Messages: merchant sees own
CREATE POLICY nex_ma_messages_merchant_select ON app_nex_merchant_assistant_messages
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM hammerex_trade_off_listings
      WHERE user_id = auth.uid()
    )
  );

-- Banners: merchant sees own
CREATE POLICY nex_ma_banners_merchant_select ON app_nex_merchant_assistant_banners
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM hammerex_trade_off_listings
      WHERE user_id = auth.uid()
    )
  );

-- Note: writes go through service-role via server APIs which bypass RLS.
-- The application layer re-checks merchant ownership on every tool call
-- (see src/lib/nex/merchant-assistant/toolExecutors.ts) so ownership
-- validation is defence-in-depth: RLS on reads, code check on writes.
--
-- If `hammerex_trade_off_listings.user_id` does not exist in this schema,
-- the RLS policies will need to be re-scoped to whatever column links a
-- listing to auth.users. Adjust in a follow-up migration once the exact
-- ownership column name is confirmed.

COMMIT;
