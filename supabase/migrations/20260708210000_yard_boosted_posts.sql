-- The Yard v3 — boosted posts (paid pin to top).
--
-- Simple mechanic: a trade pays for a boost, which sets
-- is_boosted_until to now() + N hours. The feed query sorts boosted
-- rows before pinned + created_at, so the paid post floats to the
-- top of every relevant filter until the timestamp expires. Once
-- expired the post returns to its natural chronological slot with
-- zero further action.
--
-- Payment plumbing lives in the API layer (see /api/trade-off/yard/
-- posts/[id]/boost). This migration is DB-only.

BEGIN;

ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS is_boosted_until timestamptz,
  -- Denormalised counter for admin analytics + trade dashboard —
  -- how many times has this post been boosted historically.
  ADD COLUMN IF NOT EXISTS boost_count int NOT NULL DEFAULT 0
    CHECK (boost_count >= 0),
  -- Total pence paid for boosts on this post — for revenue
  -- attribution + refund audits.
  ADD COLUMN IF NOT EXISTS boost_paid_pence int NOT NULL DEFAULT 0
    CHECK (boost_paid_pence >= 0);

-- Feed-hot-path index — boosted-first, then most recent. Partial to
-- exclude expired boosts from the "hot" branch of the plan.
CREATE INDEX IF NOT EXISTS yard_posts_boosted_hot_idx
  ON hammerex_trade_off_yard_posts (is_boosted_until DESC, created_at DESC)
  WHERE status = 'live'
    AND is_boosted_until IS NOT NULL;

COMMIT;
