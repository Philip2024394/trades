-- SiteBook posts — the post-centric architecture (2026-07-18).
--
-- Shifts the SiteBook from "one shared workspace per project"
-- (Google-Doc model) to "each post is its own scoped channel"
-- (Slack-channels model). Homeowner creates posts, invites SPECIFIC
-- trades per post — invited trades only see what they're tagged in.
-- Non-invited trades on the same project don't see the post at all.
--
-- Cross-trade coordination stays possible via visibility='all-trades'
-- posts (warranty logs, project completion broadcasts).

-- =====================================================================
-- hammerex_sitebook_posts — the "channel" primary content unit
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_posts (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,

  title                 TEXT,
  body                  TEXT          NOT NULL,
  cover_photo_url       TEXT,

  -- 'update'      — homeowner sharing progress
  -- 'new-work'    — homeowner requesting a new job
  -- 'question'    — homeowner asking something
  -- 'warranty'    — warranty logged (usually system-triggered)
  -- 'completion'  — project or milestone marked done
  -- 'trade-note'  — trade posting an update
  kind                  TEXT          NOT NULL DEFAULT 'update',

  -- 'selected'   — only invited members see it (in hammerex_sitebook_post_members)
  -- 'all-trades' — every trade on the parent project sees it (broadcast)
  visibility            TEXT          NOT NULL DEFAULT 'selected',

  author_type           TEXT          NOT NULL DEFAULT 'homeowner',  -- 'homeowner' | 'trade' | 'system'
  author_listing_id     UUID,                                        -- if author_type='trade', which merchant
  author_display_name   TEXT          NOT NULL,

  reply_count           INTEGER       NOT NULL DEFAULT 0,
  last_reply_at         TIMESTAMPTZ,
  pinned                BOOLEAN       NOT NULL DEFAULT FALSE,
  status                TEXT          NOT NULL DEFAULT 'open',       -- 'open' | 'closed' | 'archived'

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_posts_project     ON public.hammerex_sitebook_posts (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sitebook_posts_homeowner   ON public.hammerex_sitebook_posts (homeowner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sitebook_posts_kind        ON public.hammerex_sitebook_posts (kind);
CREATE INDEX IF NOT EXISTS idx_sitebook_posts_visibility  ON public.hammerex_sitebook_posts (visibility);
CREATE INDEX IF NOT EXISTS idx_sitebook_posts_status      ON public.hammerex_sitebook_posts (status);

-- =====================================================================
-- hammerex_sitebook_post_members — per-post trade invitations
-- =====================================================================
-- Only populated when posts.visibility='selected'. The set of trades
-- who can see + reply to a specific post. Independent from the parent
-- project's hired trades — a homeowner might invite only 2 of 4 hired
-- trades to a specific update.
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_post_members (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               UUID          NOT NULL REFERENCES public.hammerex_sitebook_posts(id) ON DELETE CASCADE,
  listing_id            UUID          NOT NULL,                     -- merchant's listing id
  merchant_slug         TEXT,
  merchant_name         TEXT,

  -- 'primary'    — the trade this post is FOR
  -- 'copied-in'  — additional trade who should see it (coordination)
  -- 'observer'   — read-only (rare; e.g. project manager)
  role                  TEXT          NOT NULL DEFAULT 'primary',

  last_read_at          TIMESTAMPTZ,                                -- for unread badges on trade side
  invited_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (post_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_sitebook_post_members_post     ON public.hammerex_sitebook_post_members (post_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_post_members_listing  ON public.hammerex_sitebook_post_members (listing_id, invited_at DESC);

-- =====================================================================
-- hammerex_sitebook_post_replies — the comment thread on each post
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_post_replies (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               UUID          NOT NULL REFERENCES public.hammerex_sitebook_posts(id) ON DELETE CASCADE,

  author_type           TEXT          NOT NULL,                     -- 'homeowner' | 'trade' | 'system'
  author_id             UUID,                                       -- homeowner_id OR listing_id
  author_name           TEXT          NOT NULL,

  body                  TEXT          NOT NULL,
  attachment_url        TEXT,
  attachment_kind       TEXT,                                       -- 'photo' | 'document' | 'quote' | 'invoice'

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_post_replies_post  ON public.hammerex_sitebook_post_replies (post_id, created_at ASC);

-- =====================================================================
-- Extend photos with post_id — photos now attach to a specific post
-- =====================================================================
-- Legacy project-level photos keep working (post_id NULL means "project
-- photo, not attached to any specific post"). New uploads coming
-- through the composer will set post_id.
ALTER TABLE public.hammerex_sitebook_photos
  ADD COLUMN IF NOT EXISTS post_id UUID
    REFERENCES public.hammerex_sitebook_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sitebook_photos_post
  ON public.hammerex_sitebook_photos (post_id)
  WHERE post_id IS NOT NULL;

-- =====================================================================
-- Auto-update updated_at + reply_count via triggers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_posts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sitebook_posts_updated_at ON public.hammerex_sitebook_posts;
CREATE TRIGGER trg_sitebook_posts_updated_at
  BEFORE UPDATE ON public.hammerex_sitebook_posts
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_posts_touch_updated_at();

-- When a reply is inserted, increment the parent post's reply_count
-- and stamp last_reply_at. When deleted, decrement. Keeps the feed
-- ordering + badges fast without a join per query.
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_bump_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.hammerex_sitebook_posts
       SET reply_count = reply_count + 1,
           last_reply_at = NEW.created_at
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.hammerex_sitebook_posts
       SET reply_count = GREATEST(reply_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sitebook_post_replies_bump ON public.hammerex_sitebook_post_replies;
CREATE TRIGGER trg_sitebook_post_replies_bump
  AFTER INSERT OR DELETE ON public.hammerex_sitebook_post_replies
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_bump_reply_count();

-- =====================================================================
-- Row-level security — service-role only
-- =====================================================================
ALTER TABLE public.hammerex_sitebook_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_post_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_post_replies  ENABLE ROW LEVEL SECURITY;
