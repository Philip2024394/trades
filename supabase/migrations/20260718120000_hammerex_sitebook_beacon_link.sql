-- SiteBook → Yard beacon linkage (2026-07-18).
--
-- When a homeowner publishes a SiteBook project, we enqueue it into
-- the existing beacon system (hammerex_trade_off_yard_posts kind='beacon').
-- This column ties the two together so trade responses to the beacon
-- can be auto-added to the SiteBook as members.
--
-- Also: relaxes the yard_posts author requirement for beacons that
-- originate from SiteBook. Yard posts normally require a merchant
-- author_listing_id — homeowner-originated beacons don't have one,
-- so we allow NULL when sitebook_project_id IS NOT NULL.

ALTER TABLE public.hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS sitebook_project_id UUID
    REFERENCES public.hammerex_sitebook_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sitebook_homeowner_id UUID
    REFERENCES public.hammerex_homeowners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_yard_posts_sitebook_project
  ON public.hammerex_trade_off_yard_posts (sitebook_project_id)
  WHERE sitebook_project_id IS NOT NULL;

-- Storage bucket for SiteBook photos (project galleries, before/after,
-- invoices, receipts). Public read for now — future: signed URLs only
-- when Premium homeowner tier lands.
INSERT INTO storage.buckets (id, name, public)
VALUES ('sitebook-photos', 'sitebook-photos', TRUE)
ON CONFLICT (id) DO NOTHING;
