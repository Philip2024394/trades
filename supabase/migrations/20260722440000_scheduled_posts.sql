-- Scheduled auto-posting — merchant composes a post now, we publish
-- it at their chosen time. Targets canteen (their own feed) +
-- optionally yard (community feed). Publishing is one INSERT into
-- hammerex_canteen_posts since yard reads from the same table
-- filtered by `kind IN ('counter','showcase')`.
--
-- Cron `/api/cron/publish-scheduled-posts` runs every 5 minutes,
-- picks up rows where scheduled_for <= NOW() AND status='pending',
-- publishes, and marks status='posted'.

CREATE TABLE IF NOT EXISTS public.hammerex_scheduled_posts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug      TEXT NOT NULL,
  canteen_id         UUID,       -- pre-resolved on create so the cron
                                  -- doesn't need to look it up per row
  scheduled_for      TIMESTAMPTZ NOT NULL,
  -- Post payload — same shape as a manual canteen post so the cron
  -- can INSERT straight into hammerex_canteen_posts without
  -- transformation logic.
  kind               TEXT NOT NULL DEFAULT 'showcase',
  body               TEXT,
  photo_urls         TEXT[]       DEFAULT '{}'::TEXT[],
  mood_slug          TEXT,
  price_gbp          INTEGER,
  target_trade_slugs TEXT[]       DEFAULT '{}'::TEXT[],
  -- Delivery targets. Canteen is always TRUE (this is the merchant's
  -- own feed); yard becomes TRUE by using an eligible kind, which
  -- we validate on insert. Both stored for reporting.
  target_canteen     BOOLEAN NOT NULL DEFAULT TRUE,
  target_yard        BOOLEAN NOT NULL DEFAULT FALSE,
  -- Lifecycle
  status             TEXT NOT NULL DEFAULT 'pending',
                     -- pending | posted | failed | cancelled
  posted_at          TIMESTAMPTZ,
  posted_post_id     UUID,        -- FK-ish to the published canteen post
  failure_reason     TEXT,
  attempts           INTEGER NOT NULL DEFAULT 0,
  -- Provenance
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Anti-abuse: content_hash lets us reject 3-in-a-row same-body
  -- posts client-side without exposing the DB shape.
  content_hash       TEXT,

  CONSTRAINT hammerex_scheduled_posts_status_check CHECK (
    status IN ('pending', 'posted', 'failed', 'cancelled')
  ),
  CONSTRAINT hammerex_scheduled_posts_kind_check CHECK (
    kind IN ('chat', 'question', 'showcase', 'make-offer', 'announcement', 'counter')
  ),
  -- Yard-eligible kinds only. When target_yard=TRUE, kind must be
  -- one that surfaces on the aggregated yard feed.
  CONSTRAINT hammerex_scheduled_posts_yard_kind CHECK (
    target_yard = FALSE OR kind IN ('counter', 'showcase')
  ),
  -- Cap scheduling window to 90 days to avoid pending landfill.
  CONSTRAINT hammerex_scheduled_posts_window CHECK (
    scheduled_for > NOW() - INTERVAL '5 minutes'
    AND scheduled_for < NOW() + INTERVAL '90 days'
  )
);

-- Cron picker index — the hot path is "give me pending posts due
-- in the next 5 min." Partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON public.hammerex_scheduled_posts (scheduled_for)
  WHERE status = 'pending';

-- Dashboard tab — "show me my upcoming scheduled posts."
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_merchant_status
  ON public.hammerex_scheduled_posts (merchant_slug, status, scheduled_for);

-- Anti-abuse: 20-slot cap per merchant is enforced at API level
-- (needs `WHERE status='pending' AND merchant_slug=$1` count).

ALTER TABLE public.hammerex_scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Merchant sees their own; service role sees everything (used by
-- the cron + admin surfaces).
CREATE POLICY "scheduled_posts_owner_read" ON public.hammerex_scheduled_posts
  FOR SELECT USING (auth.uid() IS NULL OR merchant_slug = current_setting('request.jwt.claims', TRUE)::jsonb ->> 'merchant_slug');
