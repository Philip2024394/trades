-- Xrated Trades — The Yard admin moderation, pinning, announcements + flagging.
--
-- This migration unlocks the /admin/yard tab. Adds the columns the admin
-- moderation queue + the public feed need (moderation_status, pin flag,
-- announcement flag, flag_count + audit timestamp/reason), and introduces a
-- separate flags table so we can show "X members flagged this" and dedupe
-- one-flag-per-member-per-post.
--
-- Touches:
--   * hammerex_trade_off_yard_posts — adds 6 columns + 2 partial indexes
--     + metadata jsonb (for the welcome-message target_listing_id payload)
--   * hammerex_trade_off_yard_flags  — new table
--
-- moderation_status values: 'live' (default), 'hidden', 'spam', 'flagged'.
-- 'flagged' is auto-set when flag_count crosses the admin threshold (the
-- API route currently uses 3). 'hidden' + 'spam' are admin actions and
-- HIDE the post from the public feed. 'flagged' stays visible to members
-- but surfaces in the admin queue for review.

ALTER TABLE public.hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS is_admin_announcement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS flag_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- moderation_status whitelist. Use a separate constraint so we can
-- ALTER without disturbing the existing CHECKs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hammerex_trade_off_yard_posts_moderation_status_chk'
  ) THEN
    ALTER TABLE public.hammerex_trade_off_yard_posts
      ADD CONSTRAINT hammerex_trade_off_yard_posts_moderation_status_chk
      CHECK (moderation_status IN ('live','hidden','spam','flagged'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_yard_posts_moderation
  ON public.hammerex_trade_off_yard_posts (moderation_status)
  WHERE moderation_status <> 'live';

CREATE INDEX IF NOT EXISTS idx_yard_posts_pinned
  ON public.hammerex_trade_off_yard_posts (is_pinned, created_at DESC)
  WHERE is_pinned = true;

-- Flags table — one row per (post, reactor-listing) so a member can flag
-- a post once. UNIQUE constraint lets the API safely retry via
-- ON CONFLICT DO NOTHING without bumping the counter twice.
CREATE TABLE IF NOT EXISTS public.hammerex_trade_off_yard_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_yard_flags_post
  ON public.hammerex_trade_off_yard_flags (post_id);
