-- Pairs-with — curated accessory recommendations shown under a
-- product's PDP. Trade sets "Product A pairs well with Product B" from
-- their editor; the PDP renders a rail of these picks so a shopper
-- adds the accessory in one tap without going hunting.
--
-- Same-trade only: the anchor and accessory both belong to the same
-- listing (a trade curating their OWN catalogue, not cross-selling
-- someone else's stock). Enforced at write time in the API rather than
-- at the DB level so a future "cross-trade pairs" feature doesn't
-- require a migration to unlock.

CREATE TABLE IF NOT EXISTS hammerex_xrated_pair_with (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The anchor product — the PDP this pair renders on.
  product_id uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  -- The suggested accessory.
  accessory_product_id uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  -- Optional one-line "why they pair" copy shown under the accessory
  -- name. Kept short — the accessory card is compact.
  reason text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 140),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One pair per (product, accessory) — dedupes if the editor
  -- accidentally adds the same accessory twice.
  UNIQUE (product_id, accessory_product_id),
  -- A product can't pair with itself.
  CHECK (product_id <> accessory_product_id)
);

CREATE INDEX IF NOT EXISTS xrated_pair_with_product_sort_idx
  ON hammerex_xrated_pair_with (product_id, sort_order);
