-- Mate — the AI agent for The Networkers.
--
-- One agent, three surfaces:
--   • merchant  — floating widget on the dashboard
--   • homeowner — /sitebook + /answers helper
--   • visitor   — canteen page chatbot
--
-- Every turn is persisted so we can (a) resume conversations,
-- (b) capture feedback signal, (c) collect training data for
-- Phase 3 (fine-tune on our labelled data).

CREATE TABLE IF NOT EXISTS public.hammerex_mate_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'merchant' | 'homeowner' | 'visitor'
  surface         TEXT NOT NULL,
  -- Merchant slug OR homeowner id OR NULL for anonymous visitor
  user_key        TEXT,
  -- 'merchant_slug' | 'homeowner_id' | 'anon_ip_hash'
  user_key_type   TEXT,
  -- If surface=visitor, the merchant canteen they're chatting from
  canteen_slug    TEXT,
  -- First-message summary — powers admin observatory list
  first_message   TEXT,
  message_count   INTEGER NOT NULL DEFAULT 0,
  total_cost_pence INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mate_conv_user_recent
  ON public.hammerex_mate_conversations (user_key, surface, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_mate_conv_recent
  ON public.hammerex_mate_conversations (last_message_at DESC);

-- ─── Every message (user + Mate) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.hammerex_mate_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES public.hammerex_mate_conversations(id) ON DELETE CASCADE,
  -- 'user' | 'assistant' (Mate)
  role                TEXT NOT NULL,
  content             TEXT NOT NULL,
  -- Model used for THIS message. Cheap Haiku for chatter,
  -- Opus for hard queries. Cost tracking uses this.
  model               TEXT,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  cache_read_tokens   INTEGER,
  cache_created_tokens INTEGER,
  cost_pence          INTEGER,
  latency_ms          INTEGER,
  -- Context references — what Mate saw when answering (for
  -- debug + training data curation). JSONB snapshot of the
  -- context builder's output.
  context_snapshot    JSONB,
  -- User feedback on Mate's message (only meaningful when role='assistant')
  -- 1 = thumbs up · -1 = thumbs down · NULL = no vote
  feedback_signal     SMALLINT,
  feedback_note       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mate_msg_conv_order
  ON public.hammerex_mate_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_mate_msg_feedback
  ON public.hammerex_mate_messages (feedback_signal)
  WHERE feedback_signal IS NOT NULL;

-- Message counter + cost trigger — kept in sync so the admin list
-- reads one row per conversation instead of aggregating.
CREATE OR REPLACE FUNCTION public.fn_mate_message_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hammerex_mate_conversations
     SET message_count    = message_count + 1,
         total_cost_pence = total_cost_pence + COALESCE(NEW.cost_pence, 0),
         last_message_at  = NEW.created_at,
         first_message    = CASE
                              WHEN first_message IS NULL AND NEW.role = 'user'
                                THEN LEFT(NEW.content, 140)
                              ELSE first_message
                            END
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mate_message_insert ON public.hammerex_mate_messages;
CREATE TRIGGER trg_mate_message_insert
  AFTER INSERT ON public.hammerex_mate_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_mate_message_insert();

ALTER TABLE public.hammerex_mate_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_mate_messages      ENABLE ROW LEVEL SECURITY;

-- ─── Per-user daily usage cap (tier-based fair use) ──────────
CREATE TABLE IF NOT EXISTS public.hammerex_mate_daily_usage (
  user_key         TEXT NOT NULL,
  usage_date       DATE NOT NULL,
  messages_sent    INTEGER NOT NULL DEFAULT 0,
  cost_pence       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_key, usage_date)
);

ALTER TABLE public.hammerex_mate_daily_usage ENABLE ROW LEVEL SECURITY;
