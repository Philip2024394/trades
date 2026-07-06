-- hero_library — runtime-editable version of scripts/hero-library.json.
--
-- Purpose: let the platform (admin panel, merchant Studio) add/edit
-- hero images without a code deploy. Static JSON stays as a seed +
-- fallback; runtime reads this table when available.
--
-- Strict-match rule is enforced at query time by keyword intersection
-- (GIN-indexed keywords_strict array).
--
-- Merchant persistence lives on a separate table (merchant_hero_slots)
-- so a merchant's chosen image + preset + edits can be saved once and
-- rendered on every page-hero slot on their site.

BEGIN;

CREATE TABLE IF NOT EXISTS hero_library (
  id text PRIMARY KEY,
  image_url text NOT NULL,
  subject text NOT NULL,
  keywords_strict text[] NOT NULL DEFAULT '{}',
  excluded_trades text[] NOT NULL DEFAULT '{}',
  vibe text NOT NULL,
  text_zone jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme_palette jsonb NOT NULL DEFAULT '{}'::jsonb,
  aspect_variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  sibling_group_id text,
  hero_use_case text NOT NULL DEFAULT '',
  burned_in_text boolean NOT NULL DEFAULT false,
  worker_visible boolean NOT NULL DEFAULT false,
  recommended_use text NOT NULL DEFAULT 'hero'
    CHECK (recommended_use IN ('hero', 'split-hero', 'product-grid', 'section-content')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GIN index makes the strict-match query fast:
--   SELECT * FROM hero_library
--   WHERE keywords_strict && $1::text[]  -- $1 = merchant keywords
CREATE INDEX IF NOT EXISTS hero_library_keywords_gin
  ON hero_library USING gin (keywords_strict);

CREATE INDEX IF NOT EXISTS hero_library_sibling_group_idx
  ON hero_library (sibling_group_id)
  WHERE sibling_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hero_library_recommended_use_idx
  ON hero_library (recommended_use);

-- Merchant persistence — a merchant picks a hero image per page-hero
-- slot. Slot key ('landing_hero', 'about_hero', 'services_hero', etc.)
-- lets the sibling swap apply the whole series in one write.
CREATE TABLE IF NOT EXISTS merchant_hero_slots (
  merchant_id uuid NOT NULL,
  slot_key text NOT NULL,
  image_id text NOT NULL REFERENCES hero_library(id) ON DELETE RESTRICT,
  preset text NOT NULL DEFAULT 'full_bleed'
    CHECK (preset IN ('full_bleed', 'framed', 'card')),
  edits jsonb NOT NULL DEFAULT '{}'::jsonb,
  upload_url text,
  upload_focals jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, slot_key)
);

CREATE INDEX IF NOT EXISTS merchant_hero_slots_image_id_idx
  ON merchant_hero_slots (image_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION hero_library_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hero_library_touch ON hero_library;
CREATE TRIGGER hero_library_touch
  BEFORE UPDATE ON hero_library
  FOR EACH ROW
  EXECUTE FUNCTION hero_library_touch_updated_at();

DROP TRIGGER IF EXISTS merchant_hero_slots_touch ON merchant_hero_slots;
CREATE TRIGGER merchant_hero_slots_touch
  BEFORE UPDATE ON merchant_hero_slots
  FOR EACH ROW
  EXECUTE FUNCTION hero_library_touch_updated_at();

-- RLS: hero_library is publicly readable (it's the public asset library);
-- writes require admin. merchant_hero_slots is per-merchant.
ALTER TABLE hero_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_hero_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hero_library_read_all ON hero_library;
CREATE POLICY hero_library_read_all
  ON hero_library
  FOR SELECT
  USING (true);

-- Writes handled via server-side admin (service key). Deliberately no
-- client-side insert/update policy — admin panel does mutations via
-- the service role.

DROP POLICY IF EXISTS merchant_hero_slots_owner_all ON merchant_hero_slots;
CREATE POLICY merchant_hero_slots_owner_all
  ON merchant_hero_slots
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

COMMIT;
