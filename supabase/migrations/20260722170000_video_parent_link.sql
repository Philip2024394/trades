-- Add parent_video_id — allows a feed-class row to reference the
-- library-class row it was re-posted from. When the library video
-- is deleted, feed-post references cascade-delete too (correct
-- behaviour — feed can't reference a video that no longer exists).
--
-- Also add extra_video_slots to track washer-purchased slot buyups
-- above the tier's base library cap.

ALTER TABLE hammerex_videos
  ADD COLUMN IF NOT EXISTS parent_video_id uuid
    REFERENCES hammerex_videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hammerex_videos_parent
  ON hammerex_videos (parent_video_id);

-- Merchant-level counter for washer-purchased extra library slots.
-- Stored on the trade-off listings row so tier + extras are queried
-- in a single lookup.
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS extra_video_slots int NOT NULL DEFAULT 0;
