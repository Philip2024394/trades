-- Notification Engine · unified delivery pipeline.
-- Phase 3.1 of the engine-first roadmap.
--
-- Every product (SiteBook · Home Care · Yard · Marketplace · Delivery · Rentals · future)
-- calls the same notify() with a recipient + template + channels[]. Adapter delivers
-- via WhatsApp deep-link / Postmark email / web push / SMS / in-app.
--
-- Two tables:
--   * hammerex_notification_intents  — every notify() attempt (audit + retry surface)
--   * hammerex_in_app_notifications  — the user-visible in-app notification list

CREATE TABLE IF NOT EXISTS public.hammerex_notification_intents (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHO
  recipient_kind       TEXT           NOT NULL,          -- 'homeowner' | 'trade' | 'merchant' | 'admin' | 'guest'
  recipient_id         TEXT,                             -- id in the respective table (nullable for guest)
  recipient_email      TEXT,
  recipient_phone      TEXT,
  recipient_display    TEXT,

  -- WHAT
  template_slug        TEXT           NOT NULL,          -- e.g. 'homeowner.welcome', 'trade.invite_received', 'homecare.reminder'
  template_data        JSONB,                            -- variables merged into the template

  -- HOW — array of channels attempted; first-that-succeeds wins per product policy
  channels             TEXT[]         NOT NULL,          -- ['email','whatsapp','web_push','sms','in_app']

  -- DELIVERY outcome
  status               TEXT           NOT NULL DEFAULT 'pending',
                                       -- 'pending' | 'sent' | 'failed' | 'skipped'
  delivered_via        TEXT,                             -- which channel actually delivered
  delivery_provider_id TEXT,                             -- Postmark msg id, etc.
  sent_at              TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,
  error_message        TEXT,

  -- CONTEXT
  product              TEXT,                             -- 'sitebook' | 'yard' | 'home_care' | 'auth' | ...
  related_target_kind  TEXT,
  related_target_id    TEXT,

  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient
  ON public.hammerex_notification_intents (recipient_kind, recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notif_status_recent
  ON public.hammerex_notification_intents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_template
  ON public.hammerex_notification_intents (template_slug, created_at DESC);

ALTER TABLE public.hammerex_notification_intents ENABLE ROW LEVEL SECURITY;
-- Service-role only. Admin dashboards read via API layer.


-- User-visible in-app notification list. Populated by notify() when
-- 'in_app' is in the channels array. Read by /sitebook + trade dashboards.

CREATE TABLE IF NOT EXISTS public.hammerex_in_app_notifications (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id         UUID           REFERENCES public.hammerex_notification_intents(id) ON DELETE SET NULL,

  recipient_kind    TEXT           NOT NULL,
  recipient_id      TEXT           NOT NULL,

  title             TEXT           NOT NULL,
  body              TEXT,
  action_url        TEXT,
  icon_slug         TEXT,                                -- lucide icon name

  read_at           TIMESTAMPTZ,
  dismissed_at     TIMESTAMPTZ,

  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notif_recipient_unread
  ON public.hammerex_in_app_notifications (recipient_kind, recipient_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_in_app_notif_recipient_all
  ON public.hammerex_in_app_notifications (recipient_kind, recipient_id, created_at DESC);

ALTER TABLE public.hammerex_in_app_notifications ENABLE ROW LEVEL SECURITY;
