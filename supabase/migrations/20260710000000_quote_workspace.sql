-- Quote Workspace — App #002.
--
-- The loop-closer between AI Visualiser (produces Specifications) and
-- installation (via accepted Orders). A quote pivots on:
--   • a Project (from OS foundation)
--   • an optional Specification (usually the latest AI Visualiser BOM)
--   • a Business (the merchant/trade quoting)
--   • a target Homeowner (via app_ai_visualiser_homeowners or party_id)
--
-- Homeowner comparison is a foundational feature — they can hold
-- multiple quotes against the same Project and pick side-by-side.
--
-- Public share tokens let a homeowner open a quote from a WhatsApp
-- link without needing to log in.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Quotes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_quote_workspace_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  specification_id uuid REFERENCES os_specifications(id) ON DELETE SET NULL,
  merchant_id uuid NOT NULL,              -- hammerex_trade_off_listings.id
  homeowner_id uuid REFERENCES app_ai_visualiser_homeowners(id) ON DELETE SET NULL,
  homeowner_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','viewed','accepted','rejected','expired','withdrawn'
  )),
  currency text NOT NULL DEFAULT 'GBP',
  materials_pence integer NOT NULL DEFAULT 0,
  labour_pence integer NOT NULL DEFAULT 0,
  vat_pence integer NOT NULL DEFAULT 0,
  discount_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  deposit_pence integer,
  timeline_estimate text,                 -- e.g. "2 weeks, starting Feb"
  notes text,                             -- merchant-authored cover copy
  expires_at timestamptz,
  share_token text NOT NULL UNIQUE,       -- for /quote/[token] public view
  -- Delivery + tracking
  sent_at timestamptz,
  sent_channel text CHECK (sent_channel IN ('whatsapp','email','link')),
  first_viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_quote_ws_quotes_project_idx
  ON app_quote_workspace_quotes (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_quote_ws_quotes_merchant_idx
  ON app_quote_workspace_quotes (merchant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_quote_ws_quotes_homeowner_idx
  ON app_quote_workspace_quotes (homeowner_id) WHERE homeowner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_quote_ws_quotes_party_idx
  ON app_quote_workspace_quotes (homeowner_party_id) WHERE homeowner_party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_quote_ws_quotes_property_idx
  ON app_quote_workspace_quotes (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_quote_ws_quotes_expiry_idx
  ON app_quote_workspace_quotes (expires_at) WHERE expires_at IS NOT NULL AND status IN ('sent','viewed');

-- ---------------------------------------------------------------------
-- 2. Quote line items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_quote_workspace_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES app_quote_workspace_quotes(id) ON DELETE CASCADE,
  position integer NOT NULL,               -- sort order
  kind text NOT NULL CHECK (kind IN ('material','labour','fee','discount','note')),
  sku text,                                -- if pulled from Products (future)
  label text NOT NULL,
  description text,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit text,                                -- 'each' / 'm2' / 'linear-m' / 'hour' / 'day'
  unit_price_pence integer,
  total_pence integer NOT NULL DEFAULT 0,
  source_business_listing_id uuid,          -- supplier merchant (if pulled from their catalog)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_quote_ws_items_quote_idx
  ON app_quote_workspace_quote_items (quote_id, position);

-- ---------------------------------------------------------------------
-- 3. Quote events — audit trail per quote
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_quote_workspace_quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES app_quote_workspace_quotes(id) ON DELETE CASCADE,
  verb text NOT NULL CHECK (verb IN (
    'drafted','sent','viewed','downloaded',
    'accepted','rejected','expired','withdrawn','revised','commented'
  )),
  actor_kind text CHECK (actor_kind IN ('merchant','homeowner','system')),
  actor_party_id uuid REFERENCES os_parties(id),
  actor_business_listing_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_quote_ws_events_quote_idx
  ON app_quote_workspace_quote_events (quote_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION quote_workspace_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_quote_ws_quotes_touch ON app_quote_workspace_quotes;
CREATE TRIGGER app_quote_ws_quotes_touch
  BEFORE UPDATE ON app_quote_workspace_quotes
  FOR EACH ROW
  EXECUTE FUNCTION quote_workspace_touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS — merchant-scoped for the writable path. Public reads through the
-- signed share token happen via a server helper with the service key.
-- ---------------------------------------------------------------------
ALTER TABLE app_quote_workspace_quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_quote_workspace_quote_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_quote_workspace_quote_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_quote_ws_quotes_merchant ON app_quote_workspace_quotes;
CREATE POLICY app_quote_ws_quotes_merchant
  ON app_quote_workspace_quotes
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_quote_ws_items_via_quote ON app_quote_workspace_quote_items;
CREATE POLICY app_quote_ws_items_via_quote
  ON app_quote_workspace_quote_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_quote_workspace_quotes q
      WHERE q.id = quote_id AND q.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_quote_workspace_quotes q
      WHERE q.id = quote_id AND q.merchant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS app_quote_ws_events_via_quote ON app_quote_workspace_quote_events;
CREATE POLICY app_quote_ws_events_via_quote
  ON app_quote_workspace_quote_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_quote_workspace_quotes q
      WHERE q.id = quote_id AND q.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_quote_workspace_quotes q
      WHERE q.id = quote_id AND q.merchant_id = auth.uid()
    )
  );

COMMIT;
