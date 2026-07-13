-- What's in the box — bento of items included with the product.
-- Each row is one line item ("2x plaster boards", "1x spare screw
-- pack"). Trades add these from their editor so a shopper can see
-- exactly what arrives, not just the hero image. Optional per-item
-- image; falls back to the product cover if omitted.

CREATE TABLE IF NOT EXISTS hammerex_xrated_what_in_box (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  qty int NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 999),
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xrated_what_in_box_product_sort_idx
  ON hammerex_xrated_what_in_box (product_id, sort_order);
