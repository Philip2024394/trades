-- merchant_pages — persistence for the live-edit surface.
--
-- One row per (merchant, page_slug). Stores draft + published section
-- configs as JSONB. Merchants edit → draft updated. Publish button →
-- draft copied to published. Public visitors read published; the
-- merchant themselves (in edit mode) reads draft.
--
-- Schema is intentionally section-agnostic: `sections` is a JSONB
-- object keyed by section_id. Each section stores whatever its type
-- needs (hero → { image_id, preset, edits }, text → { headline,
-- subhead, cta_label }, before_after → { pairs, heading, subhead },
-- etc.). The renderer knows how to interpret each key.

BEGIN;

CREATE TABLE IF NOT EXISTS merchant_pages (
  merchant_id uuid NOT NULL,
  page_slug text NOT NULL,
  draft_sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (merchant_id, page_slug)
);

CREATE INDEX IF NOT EXISTS merchant_pages_updated_idx
  ON merchant_pages (merchant_id, draft_updated_at DESC);

-- Trigger to keep draft_updated_at fresh on any draft change
CREATE OR REPLACE FUNCTION merchant_pages_touch_draft_updated_at()
  RETURNS trigger AS $$
BEGIN
  IF NEW.draft_sections IS DISTINCT FROM OLD.draft_sections THEN
    NEW.draft_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchant_pages_touch_draft ON merchant_pages;
CREATE TRIGGER merchant_pages_touch_draft
  BEFORE UPDATE ON merchant_pages
  FOR EACH ROW
  EXECUTE FUNCTION merchant_pages_touch_draft_updated_at();

-- RLS: public visitors can read published_sections (via a view or
-- filter), merchants can read/write their own row.
ALTER TABLE merchant_pages ENABLE ROW LEVEL SECURITY;

-- Public read policy for published pages
DROP POLICY IF EXISTS merchant_pages_read_published ON merchant_pages;
CREATE POLICY merchant_pages_read_published
  ON merchant_pages
  FOR SELECT
  USING (published_at IS NOT NULL);

-- Merchant policy — full access to own rows
DROP POLICY IF EXISTS merchant_pages_owner_all ON merchant_pages;
CREATE POLICY merchant_pages_owner_all
  ON merchant_pages
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

COMMIT;
