-- Notebook — Merchant Inbox read path.
--
-- A merchant needs to see the quote requests where their slug appears
-- inside the `merchant_slugs` jsonb array. Trade-owned rows still can't
-- be modified by merchants; this is read-only surface.
--
-- Because merchants authenticate via cookie session (see
-- src/lib/os/merchantSession.ts) — not Supabase auth — the actual read
-- happens via a server helper using the service key. We still add a
-- Postgres helper function so future direct-SQL consumers have a
-- canonical filter.

BEGIN;

-- Convenience function: does this request target this merchant slug?
CREATE OR REPLACE FUNCTION app_notebook_request_targets_merchant(
  request_row app_notebook_quote_requests,
  merchant_slug text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(request_row.merchant_slugs) AS slug
    WHERE slug = merchant_slug
  );
$$;

-- Merchant-facing view: flatten the fan-out so a merchant sees one row
-- per (request, their slug) with just the items that belong to them.
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
  )                            AS merchant_item_count
FROM app_notebook_quote_requests r
CROSS JOIN LATERAL jsonb_array_elements_text(r.merchant_slugs) AS slug
WHERE r.status IN ('sent','partially-quoted');

COMMENT ON VIEW app_notebook_merchant_inbox IS
  'Trade-initiated quote requests flattened one row per merchant slug. '
  'Consumed server-side via supabaseAdmin under the merchant session cookie.';

COMMIT;
