-- Add `warranty_years` to product rows so the PDP can render a
-- warranty timeline (Phase 6 port from hammerexdirect's PDP).
--
-- Nullable — trades without a warranty policy leave this null and the
-- PDP's warranty timeline auto-hides. Values interpreted in whole
-- years; sub-year cover doesn't need a schema column (goes in the FAQ).

ALTER TABLE hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS warranty_years int
    CHECK (warranty_years IS NULL OR warranty_years BETWEEN 1 AND 25);
