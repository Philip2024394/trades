-- Site editor templates — sibling groups.
--
-- A "sibling group" links several templates that share the SAME
-- design intent authored for DIFFERENT frames — e.g. the "Sale"
-- promo authored 3 times for ig-feed (1:1), ig-portrait (4:5) and
-- ig-story (9:16). The public TemplatesDrawer collapses siblings
-- into one card with a "3 sizes" pip so the merchant picks the
-- design, and we auto-adopt the sibling matching their current
-- frame.
--
-- Templates without a sibling stand alone (sibling_group_slug is
-- NULL). Grouping is opt-in — nothing breaks if a template has no
-- siblings.
--
-- Constraint: two templates in the same group MUST target different
-- frames. Same-frame duplicates would be authoring mistakes.

ALTER TABLE public.hammerex_site_editor_templates
  ADD COLUMN IF NOT EXISTS sibling_group_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_hammerex_editor_templates_sibling
  ON public.hammerex_site_editor_templates (sibling_group_slug)
  WHERE sibling_group_slug IS NOT NULL;

-- Enforce: within a sibling group, each frame_slug appears at most
-- once. Doesn't fire when sibling_group_slug is NULL (standalones).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hammerex_editor_templates_sibling_frame
  ON public.hammerex_site_editor_templates (sibling_group_slug, frame_slug)
  WHERE sibling_group_slug IS NOT NULL;
