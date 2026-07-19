-- SiteBook WhatsApp threads + messages (2026-07-18).
--
-- Solves the "record WhatsApp conversation" problem inside a
-- fully-encrypted messenger: we can't intercept WhatsApp, so we
-- compose messages INSIDE SiteBook first, save the record, then
-- open wa.me with the pre-filled text. Homeowner hits send in
-- WhatsApp. Outgoing message is captured 100% (we authored it).
--
-- Reply capture: every outgoing message includes a short-link
-- footer (nw.app/r/{token}) pointing back to a public reply page
-- keyed on a per-thread crypto token. Trade taps link → replies
-- via textarea → lands as inbound message on the SAME thread &
-- SAME parent post. Full record chronologically.
--
-- Token security:
--   - crypto-random 12+ chars (~62^12 possibilities)
--   - one thread token = one conversation (reusable across replies)
--   - scoped to a single trade_listing_id (only Watson can reply)
--   - rate-limited at the API layer
--   - revocable by homeowner via revoked_at

-- =====================================================================
-- hammerex_sitebook_wa_threads — one row per conversation
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_wa_threads (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  token                 TEXT          NOT NULL,                              -- crypto-random, unguessable

  post_id               UUID          NOT NULL REFERENCES public.hammerex_sitebook_posts(id) ON DELETE CASCADE,
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,

  -- The trade this thread runs with. Only THIS listing may use the
  -- token to reply. Nullable in case of future 'system' threads.
  trade_listing_id      UUID,
  trade_merchant_slug   TEXT,
  trade_merchant_name   TEXT,
  trade_whatsapp_e164   TEXT,                                                -- +447… stripped, snapshot at thread creation

  message_count         INTEGER       NOT NULL DEFAULT 0,
  last_activity_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ,                                         -- homeowner kill-switch

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sitebook_wa_threads_token   ON public.hammerex_sitebook_wa_threads (token);
CREATE INDEX IF NOT EXISTS idx_sitebook_wa_threads_post            ON public.hammerex_sitebook_wa_threads (post_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_wa_threads_homeowner       ON public.hammerex_sitebook_wa_threads (homeowner_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_sitebook_wa_threads_trade           ON public.hammerex_sitebook_wa_threads (trade_listing_id, last_activity_at DESC);

-- =====================================================================
-- hammerex_sitebook_wa_messages — the message log per thread
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_wa_messages (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             UUID          NOT NULL REFERENCES public.hammerex_sitebook_wa_threads(id) ON DELETE CASCADE,

  -- 'outgoing' — homeowner authored (we composed it here first)
  -- 'inbound'  — trade replied via /r/{token} link
  direction             TEXT          NOT NULL,

  -- 'homeowner' | 'trade' — mirrors direction but explicit for
  -- query convenience; author_id points at homeowner OR listing
  author_type           TEXT          NOT NULL,
  author_id             UUID,
  author_display_name   TEXT          NOT NULL,

  body                  TEXT          NOT NULL,
  template_used         TEXT,                                                -- e.g. 'ask-for-quote', 'confirm-booking'

  -- 'whatsapp'   — homeowner hit wa.me link (outgoing default)
  -- 'reply-link' — trade replied on /r/{token} page (inbound default)
  -- 'paste-back' — homeowner manually pasted a reply after the fact
  sent_via              TEXT          NOT NULL,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_wa_messages_thread       ON public.hammerex_sitebook_wa_messages (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sitebook_wa_messages_direction    ON public.hammerex_sitebook_wa_messages (direction);

-- =====================================================================
-- Triggers — keep thread counters fresh
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_wa_bump_thread()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.hammerex_sitebook_wa_threads
       SET message_count    = message_count + 1,
           last_activity_at = NEW.created_at
     WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.hammerex_sitebook_wa_threads
       SET message_count = GREATEST(message_count - 1, 0)
     WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sitebook_wa_messages_bump ON public.hammerex_sitebook_wa_messages;
CREATE TRIGGER trg_sitebook_wa_messages_bump
  AFTER INSERT OR DELETE ON public.hammerex_sitebook_wa_messages
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_wa_bump_thread();

-- =====================================================================
-- Row-level security — service-role only
-- =====================================================================
ALTER TABLE public.hammerex_sitebook_wa_threads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_wa_messages  ENABLE ROW LEVEL SECURITY;
