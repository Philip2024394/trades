-- Reverse the earlier cascade trigger. Saves must PERSIST when the
-- source video is deleted so the saved-media rail can render a
-- tombstone ("owner removed this video") — per Philip 2026-07-20.
--
-- The rail component checks the video's status column and renders:
--   • normal card if status = 'live'
--   • tombstone with "removed by owner" message if status = 'removed'
--     or the video row no longer exists (row-not-found = removed)

DROP TRIGGER IF EXISTS hammerex_media_saves_cleanup_video_trg ON hammerex_videos;
DROP FUNCTION IF EXISTS hammerex_media_saves_cleanup_video();
