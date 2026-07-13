-- The Yard v3 — dedicated comments system.
--
-- Replaces the legacy child-post pattern (yard posts with parent_id
-- doubling as comments) with a proper hammerex_yard_comments table.
-- Slimmer schema (no title / trade_slug / kind overhead per comment),
-- per-comment reactions, one-level threaded replies, soft delete.
--
-- Auth: comments are trades-only. UI enforces via magic-link (slug +
-- edit_token) — the DB stores author_listing_id and trusts that.
--
-- The legacy child-post rows on hammerex_trade_off_yard_posts stay
-- untouched — they render on the /trade-off/yard/[id] detail page as
-- historical replies. New comments land in the new table.

BEGIN;

-- ── Comments table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_yard_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL
    REFERENCES hammerex_trade_off_yard_posts(id) ON DELETE CASCADE,
  author_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  -- One-level nesting only. parent_comment_id is null for top-level
  -- comments, points to another comment id for a reply. Nested replies
  -- (reply-to-reply) get flattened up to the same parent by API.
  parent_comment_id uuid
    REFERENCES hammerex_yard_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  -- Moderation
  flag_count int NOT NULL DEFAULT 0 CHECK (flag_count >= 0),
  moderation_status text NOT NULL DEFAULT 'live'
    CHECK (moderation_status IN ('live', 'hidden', 'spam')),
  moderation_reason text,
  moderated_at timestamptz,
  -- Soft delete so the thread structure stays coherent
  deleted_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yard_comments_post_created_idx
  ON hammerex_yard_comments (post_id, created_at)
  WHERE deleted_at IS NULL AND moderation_status = 'live';

CREATE INDEX IF NOT EXISTS yard_comments_parent_idx
  ON hammerex_yard_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS yard_comments_author_idx
  ON hammerex_yard_comments (author_listing_id, created_at DESC);


-- ── Reactions per comment (like / dislike) ─────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_yard_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL
    REFERENCES hammerex_yard_comments(id) ON DELETE CASCADE,
  reactor_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reactor_listing_id)
);

CREATE INDEX IF NOT EXISTS yard_comment_reactions_comment_idx
  ON hammerex_yard_comment_reactions (comment_id, kind);


-- ── Comment flags (moderation) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_yard_comment_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL
    REFERENCES hammerex_yard_comments(id) ON DELETE CASCADE,
  reporter_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_listing_id)
);


-- ── Denormalised comment_count on parent posts ─────────────────────
-- Avoids a COUNT(*) subquery on every feed render. Trigger keeps it
-- in sync with the live/non-deleted comments only.
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0
    CHECK (comment_count >= 0);

CREATE OR REPLACE FUNCTION hammerex_yard_comments_recount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_post uuid;
BEGIN
  target_post := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE hammerex_trade_off_yard_posts
     SET comment_count = (
       SELECT count(*)
         FROM hammerex_yard_comments
        WHERE post_id = target_post
          AND deleted_at IS NULL
          AND moderation_status = 'live'
     )
   WHERE id = target_post;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS yard_comments_recount_ins ON hammerex_yard_comments;
CREATE TRIGGER yard_comments_recount_ins
AFTER INSERT ON hammerex_yard_comments
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_comments_recount();

DROP TRIGGER IF EXISTS yard_comments_recount_upd ON hammerex_yard_comments;
CREATE TRIGGER yard_comments_recount_upd
AFTER UPDATE OF deleted_at, moderation_status
       ON hammerex_yard_comments
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_comments_recount();

DROP TRIGGER IF EXISTS yard_comments_recount_del ON hammerex_yard_comments;
CREATE TRIGGER yard_comments_recount_del
AFTER DELETE ON hammerex_yard_comments
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_comments_recount();


-- ── Flag-count denormalisation on the comment itself ───────────────
-- Simple: when a flag row is inserted, bump flag_count; when a comment
-- crosses 3 flags, auto-flip moderation_status to 'hidden' pending
-- admin review (same threshold as the post flag route).
CREATE OR REPLACE FUNCTION hammerex_yard_comment_flag_bump()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE hammerex_yard_comments
     SET flag_count = flag_count + 1,
         moderation_status = CASE
           WHEN flag_count + 1 >= 3 THEN 'hidden'
           ELSE moderation_status
         END,
         moderated_at = CASE
           WHEN flag_count + 1 >= 3 THEN now()
           ELSE moderated_at
         END
   WHERE id = NEW.comment_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS yard_comment_flag_bump_ins ON hammerex_yard_comment_flags;
CREATE TRIGGER yard_comment_flag_bump_ins
AFTER INSERT ON hammerex_yard_comment_flags
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_comment_flag_bump();

COMMIT;
