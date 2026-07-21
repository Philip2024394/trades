-- Rule 3 · non-destructive soft-hide columns for moderation adapter targets.
-- Phase 5.1 continued. Every table the Moderation Engine can soft-hide
-- must expose these two columns. Add-if-missing is idempotent.

ALTER TABLE public.hammerex_sitebook_photos
  ADD COLUMN IF NOT EXISTS hidden_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

ALTER TABLE public.hammerex_trade_off_reviews
  ADD COLUMN IF NOT EXISTS hidden_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

ALTER TABLE public.hammerex_sitebook_messages
  ADD COLUMN IF NOT EXISTS hidden_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_sitebook_photos_visible
  ON public.hammerex_sitebook_photos (hidden_at)
  WHERE hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trade_off_reviews_visible
  ON public.hammerex_trade_off_reviews (hidden_at)
  WHERE hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sitebook_messages_visible
  ON public.hammerex_sitebook_messages (hidden_at)
  WHERE hidden_at IS NULL;
