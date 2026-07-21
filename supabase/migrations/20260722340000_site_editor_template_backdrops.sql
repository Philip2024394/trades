-- Template backdrop library — a curated pool of subtle backdrops
-- (branded textures, muted trade scenes, concrete/wood patterns)
-- that ship with editor templates. Kept SEPARATE from the Site
-- feed_tile_library so the template-authoring surface only sees
-- backdrops it should use — and so a merchant deleting a Site
-- image can't nuke a template's default backdrop.
--
-- Every backdrop:
--   • is AI-generated OR licensed for commercial reuse (see rights)
--   • is stored at ≥2000px long side (supports 1080×1920 export
--     without upscaling)
--   • carries a text-safe zone hint (top / bottom / centre / any)
--     so templates can position text into the readable area
--
-- Rights is a REQUIRED enum — no backdrop lands here without
-- provable provenance. Matches the platform's copyright rule.

CREATE TABLE IF NOT EXISTS public.hammerex_template_backdrops (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  slug           TEXT          NOT NULL UNIQUE,
  label          TEXT          NOT NULL,
  url            TEXT          NOT NULL,

  -- Pixel dimensions for the stored file. Long side must be ≥2000
  -- so a story-frame export (1080×1920) doesn't need upscaling.
  width_px       INTEGER       NOT NULL,
  height_px      INTEGER       NOT NULL,

  -- Where text sits comfortably over this backdrop. Templates that
  -- overlay a headline in the bottom third pick a backdrop with
  -- text_safe_zone = 'bottom' (or 'any' for uniform backdrops like
  -- gradients / textures).
  text_safe_zone TEXT          NOT NULL DEFAULT 'any',

  -- Free-tag list for backdrop discovery in the authoring UI
  -- (e.g. {'concrete','muted','warm-tone'}).
  tags           TEXT[]        NOT NULL DEFAULT '{}'::TEXT[],

  -- Rights provenance. NEVER null — the authoring flow rejects
  -- backdrops missing this so we can prove copyright chain.
  rights         TEXT          NOT NULL,

  -- Curation controls.
  active         BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order  INTEGER       NOT NULL DEFAULT 100,

  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_template_backdrops_dims_check CHECK (
    width_px >= 800 AND height_px >= 800 AND GREATEST(width_px, height_px) >= 2000
  ),
  CONSTRAINT hammerex_template_backdrops_safe_zone_check CHECK (
    text_safe_zone IN ('top', 'bottom', 'centre', 'left', 'right', 'any')
  ),
  CONSTRAINT hammerex_template_backdrops_rights_check CHECK (
    rights IN ('ai-generated', 'licensed-stock', 'commissioned', 'internal-created')
  )
);

CREATE INDEX IF NOT EXISTS idx_hammerex_template_backdrops_active
  ON public.hammerex_template_backdrops (display_order, created_at DESC)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_hammerex_template_backdrops_tags
  ON public.hammerex_template_backdrops USING GIN (tags);

ALTER TABLE public.hammerex_template_backdrops ENABLE ROW LEVEL SECURITY;

-- No RLS policies — read/write happens via service-role from the
-- admin surfaces. Public reads go through /api/site/editor/
-- template-backdrops which enforces the active + rights filter.
