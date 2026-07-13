-- Reply threads on canteen posts.
--
-- parent_id references another row in the same table. NULL means the
-- post is a top-level canteen chat post. When populated, the row is
-- a reply. Cascade delete so removing a parent cleans its replies.
--
-- Kept as a follow-up migration (not baked into the initial canteens
-- migration) so it can be applied independently without touching the
-- existing schema.

ALTER TABLE hammerex_canteen_posts
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES hammerex_canteen_posts(id) ON DELETE CASCADE;

-- Reads: top-level posts skip replies via parent_id IS NULL; a single
-- thread pulls replies by parent_id = <post-id>. Both queries need an
-- index that covers the filter.
CREATE INDEX IF NOT EXISTS hammerex_canteen_posts_parent_id
  ON hammerex_canteen_posts (parent_id)
  WHERE parent_id IS NOT NULL;

-- Top-level feed sort — canteen_id + created_at, only for parents.
-- Superset of the existing canteen_id index but adds the NULL filter
-- so top-level queries don't scan reply rows.
CREATE INDEX IF NOT EXISTS hammerex_canteen_posts_top_level
  ON hammerex_canteen_posts (canteen_id, created_at DESC)
  WHERE parent_id IS NULL AND status = 'live';
