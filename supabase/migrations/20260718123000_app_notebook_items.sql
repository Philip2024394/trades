-- Trade Notebook — the trade's editable list of usual items.
--
-- Until now DEMO_NOTEBOOK was a fixture and the trade couldn't add
-- their own items. This puts the notebook in the DB where it belongs.

BEGIN;

CREATE TABLE IF NOT EXISTS app_notebook_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id         uuid NOT NULL,
  product_name     text NOT NULL,
  spec             text,
  category_slug    text,                              -- one of BUILDER_MERCHANT_CATEGORIES slugs
  usual_qty        integer NOT NULL DEFAULT 1 CHECK (usual_qty >= 1 AND usual_qty <= 9999),
  unit             text NOT NULL DEFAULT 'each',
  last_ordered_iso timestamptz,
  image_url        text,
  archived         boolean NOT NULL DEFAULT false,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notebook_items_trade_idx
  ON app_notebook_items (trade_id, sort_order, created_at DESC)
  WHERE archived = false;
CREATE INDEX IF NOT EXISTS app_notebook_items_trade_category_idx
  ON app_notebook_items (trade_id, category_slug)
  WHERE archived = false;

CREATE OR REPLACE FUNCTION app_notebook_items_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_notebook_items_touch ON app_notebook_items;
CREATE TRIGGER app_notebook_items_touch
  BEFORE UPDATE ON app_notebook_items
  FOR EACH ROW EXECUTE FUNCTION app_notebook_items_touch();

-- RLS
ALTER TABLE app_notebook_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_notebook_items_owner ON app_notebook_items;
CREATE POLICY app_notebook_items_owner
  ON app_notebook_items
  FOR ALL
  USING (trade_id = auth.uid())
  WITH CHECK (trade_id = auth.uid());

COMMIT;
