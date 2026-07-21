-- The Site Editor — video composition jobs.
--
-- Users upload a ≤60s video, drop static overlays (text/badges/shapes)
-- over it in the editor, then hit Export. The client posts the overlay
-- state to /api/site/editor/video/compose which inserts a row here
-- (status='pending'). A cron worker picks pending rows, runs ffmpeg
-- server-side to composite the overlays + watermark, uploads the
-- result to social-media/video-exports/, marks the row 'done' with
-- output_url. The client polls /api/site/editor/video/[job_id] until
-- status flips.
--
-- We keep the raw upload path AND the composed output separately so
-- the user can re-compose with different overlays without re-uploading.

CREATE TABLE IF NOT EXISTS public.hammerex_site_editor_video_jobs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership: signed-in merchant preferred, email fallback for
  -- anonymous flow (matches the pattern used by drafts + purchases).
  owner_merchant_slug   TEXT,
  owner_email           TEXT,

  -- Storage paths inside the social-media bucket.
  input_storage_path    TEXT          NOT NULL,   -- e.g. user-videos/<slug>/<uuid>.mp4
  output_storage_path   TEXT,                     -- filled by worker on success
  input_url             TEXT          NOT NULL,
  output_url            TEXT,

  -- Source video metadata (from ffprobe).
  input_duration_s      NUMERIC       NOT NULL,
  input_width           INTEGER,
  input_height          INTEGER,
  input_bytes           INTEGER,

  -- Frame the composition should be exported at. Editor sends frame
  -- slug (ig-story / tt-video-cover / canteen-post). Worker reads
  -- src/lib/siteEditor/frames.ts to derive pixel dims.
  frame_slug            TEXT          NOT NULL,

  -- Full editor state snapshot at compose time. Same shape as the
  -- draft.state JSONB — layers, base positioning, mode. Worker
  -- iterates state.layers to build the ffmpeg filter graph.
  overlays_json         JSONB         NOT NULL,

  -- Whether the caller was on a paid tier at compose time. Worker
  -- burns the free-tier watermark into the video when this is false.
  paid                  BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Lifecycle.
  status                TEXT          NOT NULL DEFAULT 'pending',
                                       -- pending | running | done | failed
  error                 TEXT,
  attempts              INTEGER       NOT NULL DEFAULT 0,
  ran_at                TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_video_jobs_status_check CHECK (
    status IN ('pending', 'running', 'done', 'failed')
  ),
  CONSTRAINT hammerex_video_jobs_owner_check CHECK (
    owner_merchant_slug IS NOT NULL OR owner_email IS NOT NULL
  ),
  CONSTRAINT hammerex_video_jobs_duration_check CHECK (
    input_duration_s > 0 AND input_duration_s <= 60
  )
);

-- Worker polling — pick the oldest pending job that hasn't hit the
-- retry cap.
CREATE INDEX IF NOT EXISTS idx_hammerex_video_jobs_pending
  ON public.hammerex_site_editor_video_jobs (created_at ASC)
  WHERE status = 'pending' AND attempts < 3;

-- Merchant history lookups.
CREATE INDEX IF NOT EXISTS idx_hammerex_video_jobs_merchant
  ON public.hammerex_site_editor_video_jobs (owner_merchant_slug, created_at DESC)
  WHERE owner_merchant_slug IS NOT NULL;

ALTER TABLE public.hammerex_site_editor_video_jobs ENABLE ROW LEVEL SECURITY;
