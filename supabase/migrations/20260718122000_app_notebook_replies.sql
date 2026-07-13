-- Trade Notebook — merchant quote replies.
--
-- Every trade quote request fans out to N merchants; each merchant
-- gets ONE reply row per request. Replies carry unit prices per
-- request item + a promised delivery date + optional cover copy.

BEGIN;

CREATE TABLE IF NOT EXISTS app_notebook_quote_replies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL REFERENCES app_notebook_quote_requests(id) ON DELETE CASCADE,
  merchant_id         uuid NOT NULL,                   -- hammerex_trade_off_listings.id
  merchant_slug       text NOT NULL,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','withdrawn','accepted','declined','expired'
  )),
  total_gbp           numeric(10,2) NOT NULL DEFAULT 0,
  delivery_promise    text,                            -- "Tomorrow before 11am"
  delivery_date       date,                            -- earliest date merchant can deliver
  free_delivery       boolean NOT NULL DEFAULT true,
  delivery_charge_gbp numeric(10,2) NOT NULL DEFAULT 0,
  notes               text,
  submitted_at        timestamptz,
  expires_at          timestamptz,                     -- when the price stops being honoured
  viewed_by_trade_at  timestamptz,
  accepted_at         timestamptz,
  declined_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, merchant_id)
);

CREATE INDEX IF NOT EXISTS app_notebook_replies_request_idx
  ON app_notebook_quote_replies (request_id, status);
CREATE INDEX IF NOT EXISTS app_notebook_replies_merchant_idx
  ON app_notebook_quote_replies (merchant_id, status, created_at DESC);

-- Per-item pricing — one row per (reply, request_item)
CREATE TABLE IF NOT EXISTS app_notebook_quote_reply_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id          uuid NOT NULL REFERENCES app_notebook_quote_replies(id) ON DELETE CASCADE,
  request_item_id   uuid NOT NULL REFERENCES app_notebook_quote_request_items(id) ON DELETE CASCADE,
  unit_price_gbp    numeric(10,2) NOT NULL,
  qty               integer NOT NULL,
  line_total_gbp    numeric(10,2) NOT NULL,
  in_stock          boolean NOT NULL DEFAULT true,
  substituted_note  text,                              -- "closest we have is 25kg bags"
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, request_item_id)
);

CREATE INDEX IF NOT EXISTS app_notebook_reply_items_reply_idx
  ON app_notebook_quote_reply_items (reply_id);

-- Touch triggers
CREATE OR REPLACE FUNCTION app_notebook_replies_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_notebook_replies_touch ON app_notebook_quote_replies;
CREATE TRIGGER app_notebook_replies_touch
  BEFORE UPDATE ON app_notebook_quote_replies
  FOR EACH ROW EXECUTE FUNCTION app_notebook_replies_touch();

-- RLS
ALTER TABLE app_notebook_quote_replies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notebook_quote_reply_items  ENABLE ROW LEVEL SECURITY;

-- Trade can read all replies to their own requests
DROP POLICY IF EXISTS app_notebook_replies_trade_read ON app_notebook_quote_replies;
CREATE POLICY app_notebook_replies_trade_read
  ON app_notebook_quote_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_notebook_quote_requests r
      WHERE r.id = request_id AND r.trade_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS app_notebook_reply_items_trade_read ON app_notebook_quote_reply_items;
CREATE POLICY app_notebook_reply_items_trade_read
  ON app_notebook_quote_reply_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_notebook_quote_replies rep
      JOIN app_notebook_quote_requests r ON r.id = rep.request_id
      WHERE rep.id = reply_id AND r.trade_id = auth.uid()
    )
  );

-- Merchant write path runs via server helpers using the service key,
-- authorised through the cookie-based merchant session — no direct
-- client access needed. RLS enabled with no merchant policy = deny.

-- Extend the merchant_inbox view so it counts replies too
CREATE OR REPLACE VIEW app_notebook_merchant_inbox AS
SELECT
  r.id                         AS request_id,
  r.trade_id                   AS trade_id,
  r.project_id                 AS project_id,
  r.new_project_name           AS new_project_name,
  r.delivery_address           AS delivery_address,
  r.delivery_timing            AS delivery_timing,
  r.status                     AS request_status,
  r.sent_at                    AS sent_at,
  r.expires_at                 AS expires_at,
  slug.value                   AS merchant_slug,
  (
    SELECT SUM(i.line_total_gbp)
    FROM app_notebook_quote_request_items i
    WHERE i.request_id = r.id AND i.merchant_slug = slug.value
  )                            AS merchant_subtotal_gbp,
  (
    SELECT COUNT(*)::int
    FROM app_notebook_quote_request_items i
    WHERE i.request_id = r.id AND i.merchant_slug = slug.value
  )                            AS merchant_item_count,
  (
    SELECT rep.status
    FROM app_notebook_quote_replies rep
    WHERE rep.request_id = r.id AND rep.merchant_slug = slug.value
    ORDER BY rep.updated_at DESC LIMIT 1
  )                            AS reply_status,
  (
    SELECT rep.total_gbp
    FROM app_notebook_quote_replies rep
    WHERE rep.request_id = r.id AND rep.merchant_slug = slug.value
    ORDER BY rep.updated_at DESC LIMIT 1
  )                            AS reply_total_gbp
FROM app_notebook_quote_requests r
CROSS JOIN LATERAL jsonb_array_elements_text(r.merchant_slugs) AS slug
WHERE r.status IN ('sent','partially-quoted','fully-quoted');

COMMIT;
