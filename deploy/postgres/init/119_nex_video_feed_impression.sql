-- 119_nex_video_feed_impression.sql
--
-- NEX Media Foundation · Stage 2 · Video Feed V1 · Philip 2026-08-27.
--
-- Records every video-feed view + how long the viewer watched.
-- Answers the V1 gate question: "will people actually watch NEX videos?"
--
-- Design notes:
--   · viewer_id is a pure-NEX identity string (matches call_record + media_object pattern)
--   · One row per view · high-write volume expected · minimal columns
--   · watched_ms is best-effort · client posts on pause/next/unmount
--   · No PII beyond viewer_id

CREATE TABLE IF NOT EXISTS nex.video_feed_impression (
  impression_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL,        -- soft FK to nex.media_object; not enforced so hard-deletes work
  viewer_id TEXT NOT NULL,       -- pure-NEX identity string
  session_id TEXT,               -- optional client-generated session id
  watched_ms INTEGER NOT NULL DEFAULT 0,   -- best-effort · client-reported
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unmuted BOOLEAN NOT NULL DEFAULT false,  -- did viewer actively unmute?
  extras JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_video_feed_impression_media_time
  ON nex.video_feed_impression (media_id, seen_at DESC);

CREATE INDEX IF NOT EXISTS ix_video_feed_impression_viewer_time
  ON nex.video_feed_impression (viewer_id, seen_at DESC);

CREATE INDEX IF NOT EXISTS ix_video_feed_impression_time
  ON nex.video_feed_impression (seen_at DESC);

COMMENT ON TABLE nex.video_feed_impression IS
  'NEX Video Feed V1 impressions · Philip 2026-08-27. Row per view. Answers '
  'the ramp gate question for Stage 3 (social layer): "will people actually '
  'watch NEX videos?" Meaningful daily impressions + non-trivial watched_ms '
  '+ return viewers → proceed to social layer. Otherwise do NOT build '
  'follow/like/comment on top of a dead feed.';
