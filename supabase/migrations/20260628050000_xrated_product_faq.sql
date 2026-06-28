-- Per-product FAQ. JSONB array of { q, a } pairs (max 3 per product
-- enforced at the API layer). Empty array / NULL ⇒ the live PDP hides
-- the Q&A accordion entirely. Read by the public product page so a
-- merchant can answer common product-specific questions (e.g.
-- "Does this come in 50 kg?") inline with the listing.
alter table public.hammerex_xrated_products
  add column if not exists faq jsonb;
