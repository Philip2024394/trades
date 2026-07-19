-- Allow homeowner-originated beacons in yard_posts.
--
-- Prior state: hammerex_trade_off_yard_posts.listing_id NOT NULL.
-- Homeowners don't have a listing, but their SiteBook posts cross-
-- posted to the Yard as beacons need a row here. Solution: allow
-- listing_id NULL when sitebook_project_id IS NOT NULL.

ALTER TABLE public.hammerex_trade_off_yard_posts
  ALTER COLUMN listing_id DROP NOT NULL;

-- Constraint: either listing_id OR sitebook_project_id must be set.
ALTER TABLE public.hammerex_trade_off_yard_posts
  DROP CONSTRAINT IF EXISTS yard_posts_author_present;
ALTER TABLE public.hammerex_trade_off_yard_posts
  ADD CONSTRAINT yard_posts_author_present
  CHECK (listing_id IS NOT NULL OR sitebook_project_id IS NOT NULL);

-- Similarly relax trade_slug — homeowners have no slug.
ALTER TABLE public.hammerex_trade_off_yard_posts
  ALTER COLUMN trade_slug DROP NOT NULL;
