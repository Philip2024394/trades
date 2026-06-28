-- Xrated Trades — formalise customer_avatar_url on hammerex_xrated_reviews.
--
-- This column was added previously via direct DB access (or via the
-- backfill path) but never as a tracked migration in this repo. See
--   - scripts/backfill-review-avatars.mjs:6,67
--   - scripts/seed-demo-trades.mjs:148
--   - src/app/trade/[slug]/page.tsx:103,120
--   - src/components/xrated/profile/ReviewsCarousel.tsx
--
-- Defensive ADD COLUMN IF NOT EXISTS — re-running is a no-op if the column
-- is already present from the Hammerex side of the shared DB.

ALTER TABLE public.hammerex_xrated_reviews
  ADD COLUMN IF NOT EXISTS customer_avatar_url text;
