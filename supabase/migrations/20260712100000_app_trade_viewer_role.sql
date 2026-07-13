-- Trade Center — viewer_role on app_trade_profiles.
--
-- Adds the two-role model (trade / diy) so the platform can gate every
-- trade-only surface per the constitutional rule
-- (feedback_trade_features_trade_only.md).
--
-- 2026-07-12 — DIY signup path lands with this column populated at
-- account creation via /api/auth/trade/otp/verify.
--
-- Migration policy:
--   • Column is NOT NULL with default 'trade' — this preserves every
--     existing account as a trade (legacy default matches historical
--     behaviour).
--   • CHECK constraint enforces the two allowed values so a bad write
--     path can never silently create a third role.

ALTER TABLE app_trade_profiles
  ADD COLUMN IF NOT EXISTS viewer_role text NOT NULL DEFAULT 'trade'
    CHECK (viewer_role IN ('trade', 'diy'));

-- Backfill any legacy rows explicitly (idempotent — DEFAULT handles new
-- rows). Guards against pre-existing NULLs in a hand-edited dev DB.
UPDATE app_trade_profiles SET viewer_role = 'trade' WHERE viewer_role IS NULL;

COMMENT ON COLUMN app_trade_profiles.viewer_role IS
  'trade = professional tradesperson; diy = homeowner / DIY buyer. Set at signup and NEVER auto-changed. Every trade-only feature MUST gate on this column being ''trade''.';
