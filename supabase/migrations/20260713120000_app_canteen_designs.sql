-- Canteen designs — merchant-editable portfolio items shown on the
-- Designs tab of the canteen mobile app. Each row is one design (e.g.
-- a kitchen style) with a hero image, up to 3 additional gallery
-- images, and a customer-facing reference code (e.g. "DS-101") that
-- prints on the design card so customers can quote it when they
-- WhatsApp the merchant.
--
-- Kept isolated from products (which live in hammerex_canteen_products)
-- because designs are portfolio/inspiration, not saleable line items.
-- Different intent, different render path, different content ceiling.

CREATE TABLE IF NOT EXISTS hammerex_canteen_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id UUID NOT NULL REFERENCES hammerex_canteens(id) ON DELETE CASCADE,

  -- Customer-facing reference code. Merchant sets this so their own
  -- filing / WhatsApp language matches ("we have your DS-101 pulled up").
  -- Unique per canteen so two designs can't share the same ref within
  -- one merchant, but multiple merchants can each have their own DS-101.
  ref TEXT NOT NULL,

  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  style TEXT,

  -- Hero image + optional additional angles. Capped in the UI at 4
  -- total (1 hero + 3 additional); no hard cap here so future
  -- carousel modes can extend without a migration.
  image_url TEXT NOT NULL,
  gallery_urls TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Merchant reorder handle. Lower = higher up on the tab.
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Soft-delete so restoring from a snapshot never fails on a hard
  -- FK gap. Deleted rows hidden from public reads.
  archived_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_canteen_designs_ref_unique_per_canteen
    UNIQUE (canteen_id, ref)
);

-- Hot-path index: fetch all live designs for a canteen, ordered.
CREATE INDEX IF NOT EXISTS hammerex_canteen_designs_canteen_sort_idx
  ON hammerex_canteen_designs (canteen_id, sort_order, created_at)
  WHERE archived_at IS NULL;

-- Auto-touch updated_at on any change.
CREATE OR REPLACE FUNCTION hammerex_canteen_designs_touch_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_canteen_designs_updated_at ON hammerex_canteen_designs;
CREATE TRIGGER hammerex_canteen_designs_updated_at
  BEFORE UPDATE ON hammerex_canteen_designs
  FOR EACH ROW
  EXECUTE FUNCTION hammerex_canteen_designs_touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────
--
-- Public read: any visitor can see non-archived designs on a canteen
-- page — this is the merchant's public portfolio, no auth needed.
-- Merchant write: only the merchant who hosts the canteen can insert
-- / update / delete their own designs (checked via the canteen's
-- host_slug matching the authed session's slug).

ALTER TABLE hammerex_canteen_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hammerex_canteen_designs_public_read
  ON hammerex_canteen_designs;
CREATE POLICY hammerex_canteen_designs_public_read
  ON hammerex_canteen_designs FOR SELECT
  USING (archived_at IS NULL);

-- Write policies are permissive here because merchant editor writes
-- currently go through the supabaseAdmin service-role client (see
-- src/lib/supabase.ts + api/canteens/... routes). If we later expose
-- direct-from-client writes for the editor, tighten these to check
-- the JWT's slug against the host_slug on hammerex_canteens.
DROP POLICY IF EXISTS hammerex_canteen_designs_service_write
  ON hammerex_canteen_designs;
CREATE POLICY hammerex_canteen_designs_service_write
  ON hammerex_canteen_designs FOR ALL
  USING (true)
  WITH CHECK (true);
