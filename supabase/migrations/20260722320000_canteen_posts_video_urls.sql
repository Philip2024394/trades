-- Canteen posts — add video_urls column so hosts + members can
-- share the composed Site Editor MP4 into their canteen (which
-- aggregates into the Yard feed too, so one post reaches both).
--
-- Mirrors the pattern already in hammerex_trade_off_yard_posts:
-- TEXT[] array of public URLs, gated to paid tier at the API layer.
--
-- Existing rows default to empty array so historic photo-only posts
-- render identically after the migration.

ALTER TABLE public.hammerex_canteen_posts
  ADD COLUMN IF NOT EXISTS video_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Partial index — worth having since "any post with video" is a
-- common feed filter (Video-only tab in the canteen).
CREATE INDEX IF NOT EXISTS idx_hammerex_canteen_posts_has_video
  ON public.hammerex_canteen_posts (canteen_id, created_at DESC)
  WHERE cardinality(video_urls) > 0;
