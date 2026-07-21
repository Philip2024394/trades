-- hammerex_feed_tile_library — precomputed frame fitness so the
-- Site Editor's Image Library can:
--   1. Exclude images that don't cleanly fit any frame from the
--      gallery entirely (world-class quality gate).
--   2. Filter the gallery by "fits Instagram Story" or "fits Canteen"
--      without doing per-image aspect math on every render.
--   3. Auto-switch the canvas frame to an image's best-fit destination
--      when the user picks it.
--
-- Populated by scripts/backfill-frame-fits.mjs — probes the image URL
-- with sharp to read the real dimensions, then runs
-- src/lib/siteEditor/frames.computeFitsFrames.

ALTER TABLE public.hammerex_feed_tile_library
  ADD COLUMN IF NOT EXISTS natural_aspect NUMERIC,
  ADD COLUMN IF NOT EXISTS fits_frames    TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Partial index so the gallery's `fits_frames && ARRAY['ig-feed']`
-- query stays fast at 10k+ images. GIN because it's an array.
CREATE INDEX IF NOT EXISTS idx_hammerex_feed_tile_library_fits_frames
  ON public.hammerex_feed_tile_library USING GIN (fits_frames);

-- Convenience index for "any frame fits" (gallery excludes images
-- with an empty array).
CREATE INDEX IF NOT EXISTS idx_hammerex_feed_tile_library_has_fits
  ON public.hammerex_feed_tile_library ((cardinality(fits_frames)))
  WHERE cardinality(fits_frames) > 0;
