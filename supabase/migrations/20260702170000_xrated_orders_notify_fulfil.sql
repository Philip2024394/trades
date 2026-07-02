-- Online Payments phase 1.5 — order lifecycle tracking.
--
--   notified_at  — set by notifyOrderPaid() on first successful send.
--                  Idempotency guard so re-delivered webhooks never
--                  double-notify.
--   fulfilled_at — merchant flips this from the /orders dashboard when
--                  they've dispatched / completed. Independent of paid
--                  status: an order can be paid + fulfilled, paid +
--                  unfulfilled, or unpaid + not-fulfilled.
--   note         — merchant private note attached from the dashboard.

ALTER TABLE hammerex_xrated_orders
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS note text;

CREATE INDEX IF NOT EXISTS hammerex_xrated_orders_paid_at_idx
  ON hammerex_xrated_orders(listing_id, status, paid_at DESC);
