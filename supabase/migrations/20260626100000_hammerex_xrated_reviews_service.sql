-- Xrated Trades — per-service review tagging.
--
-- Customers leaving a review can now pick which priced service the
-- review is about (or leave it null for a general "great tradesperson"
-- review). Aggregation per-service stays implicit — we compute the
-- average from the rows themselves on read, no separate stored
-- aggregate column. Phase 2 will render those averages on each
-- service card and add a per-service review filter.

alter table public.hammerex_xrated_reviews
  add column if not exists service_name text;

create index if not exists hammerex_xrated_reviews_service_idx
  on public.hammerex_xrated_reviews (listing_id, service_name)
  where service_name is not null;
