-- Xrated Trades — Newsroom posts table.
--
-- Public newsroom content surface. Each row is a long-form post that
-- renders as its own URL at /news/<slug>. When a post goes live, the
-- admin API also creates a cross-post in hammerex_trade_off_yard_posts
-- so members can react + comment on it inside The Yard.
--
-- Columns:
--   slug          — URL slug (unique). Auto-generated from title in
--                   the admin composer; editable before save.
--   category      — one of 'platform' | 'opinion' | 'industry' |
--                   'how-to' | 'general'. Used for the filter chips on
--                   /news and the category badge on each card.
--   body_markdown — full post body as Markdown. Rendered server-side
--                   by a small inline parser (no remark dependency).
--   excerpt       — 1-line summary for cards + meta description.
--   banner_url    — full-width hero image (Supabase Storage URL).
--   video_url     — optional embedded video (basic <video controls>).
--   status        — 'draft' | 'live' | 'archived'. Only 'live' renders
--                   on the public newsroom + sitemap.
--   yard_post_id  — FK-less link to the cross-posted yard row. Used by
--                   the admin API to hide the yard post when the news
--                   post is archived.
--   metadata      — jsonb catch-all for future fields without a
--                   migration cost (author, hero overlay style, etc.).

CREATE TABLE IF NOT EXISTS public.hammerex_xrated_news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  body_markdown text NOT NULL DEFAULT '',
  excerpt text,
  banner_url text,
  video_url text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  yard_post_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_news_posts_status_published
  ON public.hammerex_xrated_news_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_posts_category
  ON public.hammerex_xrated_news_posts (category)
  WHERE status = 'live';
