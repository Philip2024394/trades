-- Unified media-saves table (videos + photos).
--
-- Polymorphic on both the saver (homeowner OR merchant) and the
-- saved media (video OR photo). One table, one API, one component
-- pattern across SiteBook + Canteen + Video leaf.
--
-- Design rationale:
--   • Save is a business-metric-adjacent action (fires notebook_save
--     on hammerex_video_metrics too) — this table is the persistent
--     ledger; metrics is the event stream
--   • UNIQUE constraint dedups: user can't save the same media twice
--   • CASCADE on video deletion — if the source video is removed,
--     the save row goes with it (rail always renders live content)
--
-- Not covered in v0.5 (Phase 2 additions):
--   • Photo-side cascade (needs coordination with the SiteBook
--     photo table — TBD)
--   • Collections / folders (right now: flat saved list per user)

CREATE TABLE IF NOT EXISTS hammerex_media_saves (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  saver_kind   text        NOT NULL CHECK (saver_kind IN ('homeowner', 'merchant')),
  saver_id     text        NOT NULL,
  media_kind   text        NOT NULL CHECK (media_kind IN ('video', 'photo')),
  media_id     uuid        NOT NULL,
  pinned       boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (saver_kind, saver_id, media_kind, media_id)
);

-- Cleanup trigger: when a video is deleted from hammerex_videos,
-- also remove any saves that pointed at it. We use a trigger instead
-- of a foreign key because media_id is polymorphic (video OR photo).
CREATE OR REPLACE FUNCTION hammerex_media_saves_cleanup_video()
RETURNS trigger AS $$
BEGIN
  DELETE FROM hammerex_media_saves
    WHERE media_kind = 'video' AND media_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_media_saves_cleanup_video_trg ON hammerex_videos;
CREATE TRIGGER hammerex_media_saves_cleanup_video_trg
  BEFORE DELETE ON hammerex_videos
  FOR EACH ROW EXECUTE FUNCTION hammerex_media_saves_cleanup_video();

CREATE INDEX IF NOT EXISTS idx_media_saves_by_user       ON hammerex_media_saves (saver_kind, saver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_saves_by_media      ON hammerex_media_saves (media_kind, media_id);
CREATE INDEX IF NOT EXISTS idx_media_saves_pinned        ON hammerex_media_saves (saver_kind, saver_id, pinned) WHERE pinned = true;
