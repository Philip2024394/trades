-- Trade Notebook — server persistence for the Quote Me flow.
--
-- Everything that was previously stashed in localStorage now lives here:
--   1. app_notebook_site_projects        — trade's saved site projects
--   2. app_notebook_quote_basket_items   — current draft basket (pre-submit)
--   3. app_notebook_quote_requests       — submitted quote requests
--   4. app_notebook_quote_request_items  — line items snapshotted at submit
--
-- Ownership pivot: trade_id = auth.uid() (Supabase user). RLS enforces
-- read/write per trade. Merchant-side visibility is granted via a
-- fan-out row on submit (see quote_requests.merchant_slugs jsonb) —
-- pull that into a merchant view in a follow-up when Merchant Inbox lands.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Site Projects
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_notebook_site_projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id     uuid NOT NULL,                    -- auth.uid()
  site_name    text NOT NULL,
  customer_name text,
  address_mode text CHECK (address_mode IN ('postcode','manual','what3words')),
  address_label text NOT NULL,
  address_lat  numeric(9,6),
  address_lng  numeric(9,6),
  address_postcode text,
  directions   text,
  archived     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notebook_site_projects_trade_idx
  ON app_notebook_site_projects (trade_id, created_at DESC)
  WHERE archived = false;

-- ---------------------------------------------------------------------
-- 2. Quote basket — draft, editable, one row per (trade, item_key)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_notebook_quote_basket_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id       uuid NOT NULL,
  item_key       text NOT NULL,                  -- notebook item id OR "clearance-<product-id>"
  product_name   text NOT NULL,
  spec           text,
  image_url      text,
  qty            integer NOT NULL DEFAULT 1 CHECK (qty >= 1 AND qty <= 9999),
  unit           text NOT NULL DEFAULT 'each',
  merchant_slug  text NOT NULL,
  merchant_name  text NOT NULL,
  product_slug   text NOT NULL,
  unit_price_gbp numeric(10,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, item_key)
);

CREATE INDEX IF NOT EXISTS app_notebook_basket_trade_idx
  ON app_notebook_quote_basket_items (trade_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. Quote requests — snapshot at submit
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_notebook_quote_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id          uuid NOT NULL,
  project_id        uuid REFERENCES app_notebook_site_projects(id) ON DELETE SET NULL,
  new_project_name  text,                        -- if the trade chose "+ create new" but no project yet
  delivery_address  text NOT NULL,
  delivery_timing   text NOT NULL CHECK (delivery_timing IN (
    'same-day','tomorrow','3-days','5-days','1-week'
  )),
  total_gbp         numeric(10,2) NOT NULL,
  merchant_slugs    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- distinct merchants across items
  status            text NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent','partially-quoted','fully-quoted','won','cancelled','expired'
  )),
  sent_at           timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notebook_requests_trade_idx
  ON app_notebook_quote_requests (trade_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS app_notebook_requests_project_idx
  ON app_notebook_quote_requests (project_id) WHERE project_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. Quote request items — frozen snapshot of what was in the basket
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_notebook_quote_request_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES app_notebook_quote_requests(id) ON DELETE CASCADE,
  item_key       text NOT NULL,
  product_name   text NOT NULL,
  spec           text,
  image_url      text,
  qty            integer NOT NULL,
  unit           text NOT NULL,
  merchant_slug  text NOT NULL,
  merchant_name  text NOT NULL,
  product_slug   text NOT NULL,
  unit_price_gbp numeric(10,2) NOT NULL,
  line_total_gbp numeric(10,2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notebook_request_items_request_idx
  ON app_notebook_quote_request_items (request_id);
CREATE INDEX IF NOT EXISTS app_notebook_request_items_merchant_idx
  ON app_notebook_quote_request_items (merchant_slug);

-- ---------------------------------------------------------------------
-- Triggers — updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_notebook_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_notebook_projects_touch ON app_notebook_site_projects;
CREATE TRIGGER app_notebook_projects_touch
  BEFORE UPDATE ON app_notebook_site_projects
  FOR EACH ROW EXECUTE FUNCTION app_notebook_touch_updated_at();

DROP TRIGGER IF EXISTS app_notebook_basket_touch ON app_notebook_quote_basket_items;
CREATE TRIGGER app_notebook_basket_touch
  BEFORE UPDATE ON app_notebook_quote_basket_items
  FOR EACH ROW EXECUTE FUNCTION app_notebook_touch_updated_at();

DROP TRIGGER IF EXISTS app_notebook_requests_touch ON app_notebook_quote_requests;
CREATE TRIGGER app_notebook_requests_touch
  BEFORE UPDATE ON app_notebook_quote_requests
  FOR EACH ROW EXECUTE FUNCTION app_notebook_touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS — every row is owned by the trade. Merchant read paths land in a
-- separate merchant-scoped view in a follow-up migration when Merchant
-- Inbox is wired.
-- ---------------------------------------------------------------------
ALTER TABLE app_notebook_site_projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notebook_quote_basket_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notebook_quote_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notebook_quote_request_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_notebook_projects_owner ON app_notebook_site_projects;
CREATE POLICY app_notebook_projects_owner
  ON app_notebook_site_projects
  FOR ALL
  USING (trade_id = auth.uid())
  WITH CHECK (trade_id = auth.uid());

DROP POLICY IF EXISTS app_notebook_basket_owner ON app_notebook_quote_basket_items;
CREATE POLICY app_notebook_basket_owner
  ON app_notebook_quote_basket_items
  FOR ALL
  USING (trade_id = auth.uid())
  WITH CHECK (trade_id = auth.uid());

DROP POLICY IF EXISTS app_notebook_requests_owner ON app_notebook_quote_requests;
CREATE POLICY app_notebook_requests_owner
  ON app_notebook_quote_requests
  FOR ALL
  USING (trade_id = auth.uid())
  WITH CHECK (trade_id = auth.uid());

DROP POLICY IF EXISTS app_notebook_request_items_via_request ON app_notebook_quote_request_items;
CREATE POLICY app_notebook_request_items_via_request
  ON app_notebook_quote_request_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_notebook_quote_requests r
      WHERE r.id = request_id AND r.trade_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_notebook_quote_requests r
      WHERE r.id = request_id AND r.trade_id = auth.uid()
    )
  );

COMMIT;
