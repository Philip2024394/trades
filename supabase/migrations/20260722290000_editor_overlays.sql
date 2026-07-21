-- Editor overlay library — user-uploaded stickers/badges that appear
-- in the /site/editor Overlays drawer. One row per asset.
--
-- Ownership: a merchant uploads for themselves (only they see their
-- own uploads); admin-published globals have owner_merchant_slug NULL
-- and are visible to everyone (drawer merges the two lists).
--
-- Storage: file bytes live in the `social-media` Supabase bucket
-- under user-overlays/<merchant-slug>/<uuid>.<ext> for merchant
-- uploads, or overlays/<slug>.<ext> for global assets. This table
-- carries the public URL so the drawer needs one query, not two.

CREATE TABLE IF NOT EXISTS public.hammerex_site_editor_overlays (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL for global admin-published overlays visible to everyone;
  -- else the uploading merchant's slug (only visible to them).
  owner_merchant_slug TEXT,

  label               TEXT          NOT NULL,
  -- Style category — same slugs the drawer's toggle strip uses.
  category            TEXT          NOT NULL DEFAULT 'banner',

  -- Public URL of the asset (Supabase Storage public bucket).
  url                 TEXT          NOT NULL,
  -- Aspect ratio (w/h) — used by the editor to size the layer on drop
  -- so wide banners land wide. Nullable → editor uses natural size.
  aspect_ratio        NUMERIC,

  -- Storage-side path so we can hard-delete when the row is removed.
  storage_path        TEXT,

  active              BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_editor_overlays_category_check CHECK (
    category IN ('promo','cta','trust','status','job','price','banner','custom')
  )
);

CREATE INDEX IF NOT EXISTS idx_hammerex_editor_overlays_owner
  ON public.hammerex_site_editor_overlays (owner_merchant_slug, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hammerex_editor_overlays_global
  ON public.hammerex_site_editor_overlays (category, created_at DESC)
  WHERE owner_merchant_slug IS NULL AND active = TRUE;

ALTER TABLE public.hammerex_site_editor_overlays ENABLE ROW LEVEL SECURITY;
