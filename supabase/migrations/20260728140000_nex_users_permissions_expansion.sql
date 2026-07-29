-- 20260728140000_nex_users_permissions_expansion.sql
-- D1 Turn 2 · NexUser expansion (Philip 2026-07-28)
--
-- Adds per-brain permissions + verification metadata so the user table
-- scales beyond a single global role. Enables future scenarios like
-- "Sarah can author on plumbing but only review on staircase" without
-- schema surgery later.
--
-- brain_permissions jsonb shape:
--   {
--     "brains": ["staircase", "joinery"],            -- brain slugs this user can act on
--     "capabilities": {                              -- optional per-brain fine-grained perms
--       "staircase": { "can_publish": true, "can_rollback": true }
--     }
--   }
-- Empty {} or missing "brains" = global scope inherited from `role`.
--
-- verified_at / verified_by track the human-signed verification of an
-- expert account. A user with credentials but no verified_at should be
-- treated as "claimed" not "confirmed" by the platform.

ALTER TABLE public.hammerex_nex_users
  ADD COLUMN IF NOT EXISTS brain_permissions jsonb        NOT NULL DEFAULT '{"brains": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at       timestamptz  NULL,
  ADD COLUMN IF NOT EXISTS verified_by       text         NULL,
  ADD COLUMN IF NOT EXISTS last_review_at    timestamptz  NULL;

COMMENT ON COLUMN public.hammerex_nex_users.brain_permissions IS
  'Per-brain scoping. Shape: {"brains": ["staircase"], "capabilities": {"staircase": {...}}}. Empty means role applies globally · Philip 2026-07-28';

COMMENT ON COLUMN public.hammerex_nex_users.verified_at IS
  'Timestamp when a human admin verified this expert''s credentials. Distinct from account creation · Philip 2026-07-28';

COMMENT ON COLUMN public.hammerex_nex_users.verified_by IS
  'Email of the admin who performed verification · Philip 2026-07-28';

COMMENT ON COLUMN public.hammerex_nex_users.last_review_at IS
  'Last time this user''s permissions or status were reviewed. Used to flag stale accounts · Philip 2026-07-28';

CREATE INDEX IF NOT EXISTS ix_nex_users_verified
  ON public.hammerex_nex_users(verified_at) WHERE verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_nex_users_needs_review
  ON public.hammerex_nex_users(last_review_at NULLS FIRST);
