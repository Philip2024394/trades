-- Homeowner slug URL (2026-07-18).
--
-- Every homeowner gets a `thenetworkers.app/homes/{slug}` URL — same
-- pattern as merchants at /trade/{slug} but namespaced under /homes/.
-- The slug is generated from house_nickname at signup and is unique
-- within the homeowners table.
--
-- Nickname is now REQUIRED at signup — the slug is core to the
-- SiteBook identity (it becomes the installable PWA URL).

ALTER TABLE public.hammerex_homeowners
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_homeowners_slug
  ON public.hammerex_homeowners (LOWER(slug))
  WHERE slug IS NOT NULL;

-- Make house_nickname required going forward (existing NULL rows
-- backfilled to the first_name; won't break anything).
UPDATE public.hammerex_homeowners
SET house_nickname = COALESCE(first_name, 'My SiteBook')
WHERE house_nickname IS NULL;

ALTER TABLE public.hammerex_homeowners
  ALTER COLUMN house_nickname SET NOT NULL;
