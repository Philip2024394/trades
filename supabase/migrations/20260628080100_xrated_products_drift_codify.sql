-- Xrated Trades — codify schema drift on hammerex_xrated_products.
--
-- product_kind        : 'stock' (default) or 'install' — see
--                       src/app/api/trade-off/products/upsert/route.ts:374-376
--                       and src/lib/supabase.ts:280. Default 'stock' matches
--                       the route's coercion of unknown inputs.
-- warranty_header     : capped 80 chars in API
-- warranty_text       : capped 500 chars in API
-- returns_text        : deprecated but still nullable in writes
--                       (upsert/route.ts:391-393 sets null but keeps column)
--
-- Default for product_kind is 'product' so any rows pre-dating the column
-- on a downstream DB still validate against the runtime coercion ('product'
-- gets coerced to 'stock' on next write; harmless). For a fresh trades-only
-- DB the column is 'product' until the route writes the canonical value.
-- We accept the value-space documented in the foundation doc
-- (product/install/service) by not adding a CHECK constraint — keeps this
-- migration idempotent with an existing column that may have its own enum.

ALTER TABLE public.hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS product_kind text DEFAULT 'product';

ALTER TABLE public.hammerex_xrated_products
  ADD COLUMN IF NOT EXISTS warranty_header text,
  ADD COLUMN IF NOT EXISTS warranty_text text,
  ADD COLUMN IF NOT EXISTS returns_text text;
