-- Xrated Trades — Shop Mode Phase 3 (storefront upgrade).
--
-- Adds the columns the dedicated /<slug>/shop page needs:
--   slug          per-product URL handle, unique per listing among live rows
--   featured_at   "front window" timestamp picked by the tradesperson in
--                 the editor's Featured-Products drag-picker; NULL = not
--                 featured. Newest-featured first when ranking the teaser.
--   search_tsv    generated tsvector (name A, description B, category C)
--                 fed by a partial GIN index for live rows only.
--
-- Plus a backfill — every existing live product gets a slug derived from
-- its name with per-listing dedupe (foo, foo-2, foo-3…) so the new per-
-- product page resolves on day one.

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS featured_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
      setweight(to_tsvector('english', coalesce(description,'')), 'B') ||
      setweight(to_tsvector('english', coalesce(category,'')), 'C')
    ) STORED;

-- Slug format: lowercase a-z0-9 + hyphens, 1-80 chars. NULL allowed so a
-- draft row (or a row mid-migration) can sit without a slug. The upsert
-- API auto-generates a slug whenever it's missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hammerex_xrated_products_slug_format'
      AND conrelid = 'hammerex_xrated_products'::regclass
  ) THEN
    ALTER TABLE hammerex_xrated_products
      ADD CONSTRAINT hammerex_xrated_products_slug_format
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
END
$$;

-- Unique per listing among live rows. Archived rows can collide on
-- re-use — useful when a tradesperson archives "old-name" and reuses the
-- same name on a fresh product.
CREATE UNIQUE INDEX IF NOT EXISTS hammerex_xrated_products_slug_idx
  ON hammerex_xrated_products (listing_id, slug)
  WHERE slug IS NOT NULL AND status = 'live';

-- Full-text search index — partial, live rows only. Keeps the index
-- small and lets the storefront serve search results without scanning
-- archived/draft rows.
CREATE INDEX IF NOT EXISTS hammerex_xrated_products_search_idx
  ON hammerex_xrated_products USING gin(search_tsv)
  WHERE status = 'live';

-- Featured ordering — the storefront featured rail and the profile teaser
-- both read this index. NULLS LAST so non-featured rows sit below the
-- featured ones, then fall back to created_at desc for chronological
-- order within each bucket.
CREATE INDEX IF NOT EXISTS hammerex_xrated_products_featured_idx
  ON hammerex_xrated_products (listing_id, featured_at DESC NULLS LAST, created_at DESC)
  WHERE status = 'live';

-- Backfill — every existing live row gets a slug derived from its name.
-- Per-listing dedupe via window function: first occurrence wins the bare
-- slug, later collisions append "-2", "-3" etc. Skipped for rows that
-- already have a slug (idempotent — safe to re-run).
WITH slugged AS (
  SELECT id, listing_id,
    regexp_replace(
      regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ) AS base_slug,
    row_number() OVER (
      PARTITION BY listing_id, regexp_replace(
        regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      )
      ORDER BY created_at
    ) AS rn
  FROM hammerex_xrated_products
  WHERE status = 'live' AND slug IS NULL
)
UPDATE hammerex_xrated_products p
SET slug = CASE
  WHEN s.base_slug = '' THEN NULL
  WHEN s.rn = 1 THEN s.base_slug
  ELSE s.base_slug || '-' || s.rn::text
END
FROM slugged s
WHERE p.id = s.id
  AND s.base_slug <> '';
