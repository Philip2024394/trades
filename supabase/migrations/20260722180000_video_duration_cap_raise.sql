-- Raise the duration_seconds CHECK from 180 to 900 so The Works
-- tier's 15-minute videos can persist. Per-tier enforcement lives
-- in the API layer (TIER_VIDEO_LIMITS.maxVideoLengthSeconds); the
-- DB just enforces the absolute ceiling.

ALTER TABLE hammerex_videos
  DROP CONSTRAINT IF EXISTS hammerex_videos_duration_seconds_check;

ALTER TABLE hammerex_videos
  ADD CONSTRAINT hammerex_videos_duration_seconds_check
  CHECK (duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 900));
