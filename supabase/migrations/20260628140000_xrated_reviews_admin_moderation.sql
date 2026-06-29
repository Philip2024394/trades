-- Xrated Trades — admin moderation audit trail on hammerex_xrated_reviews.
--
-- The /admin/reviews queue lets admins Mark Safe / Hide / Edit / Delete
-- reviews submitted via /trade/<slug>/review. Audit trail is via three
-- timestamp/text columns (no separate audit table — single-operator
-- admin, the timestamps + reason text are enough).
--
--   admin_marked_safe_at  — set when Mark Safe runs (also clamps goes_live_at)
--   admin_edited_at       — set whenever PATCH /api/admin/reviews/[id] touches a field
--   admin_action_reason   — internal note ("why we edited / hid"), never public
--
-- Status values now in use: 'live' | 'hidden' | 'flagged' | 'spam' (plus the
-- existing 'pending' / 'disputed' / 'withdrawn'). The original inline CHECK
-- constraint only allowed ('pending','live','hidden','disputed','withdrawn'),
-- so we drop it — Hammerex (shared DB) may add other statuses and we don't
-- want migrations on either side to fight over the constraint.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP CONSTRAINT IF EXISTS.

ALTER TABLE public.hammerex_xrated_reviews
  ADD COLUMN IF NOT EXISTS admin_marked_safe_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_action_reason text;

-- Drop the inline CHECK constraint so 'flagged' and 'spam' (and any
-- future statuses from the Hammerex side) are accepted. The original
-- migration created an anonymous CHECK; Postgres auto-names it
-- <table>_status_check. We DO NOT add a CHECK back — see header comment.
ALTER TABLE public.hammerex_xrated_reviews
  DROP CONSTRAINT IF EXISTS hammerex_xrated_reviews_status_check;

-- Pending-publish index — admins want a fast count of reviews in the
-- 24h pre-publish window for the nav badge. We can't include
-- `goes_live_at > now()` in the predicate (postgres requires IMMUTABLE
-- functions in partial-index predicates and now() is STABLE), so we
-- index goes_live_at on every live row. Queries that filter
-- `status = 'live' AND goes_live_at > now()` still use this index
-- because the planner can range-scan on goes_live_at after filtering
-- on the status partial predicate.
CREATE INDEX IF NOT EXISTS idx_reviews_pending_publish
  ON public.hammerex_xrated_reviews (goes_live_at)
  WHERE status = 'live';
