-- Xrated Trades — Affiliate full profile fields.
--
-- The /affiliates/dashboard/profile page captures the affiliate's
-- public-facing identity for leaderboard rows, white-label landing
-- pages and admin contact. WhatsApp + first/last/company/country/
-- email/socials already exist. This migration adds the missing
-- pieces requested by the user:
--   "profile image front face - name - address and country and
--    whats app number - email etc and short bio"
--
-- Storage: avatar_url points at a public Supabase Storage object
-- under product-images/affiliate-avatars/<affiliate_id>.<ext>.
-- bio is hard-capped at 280 chars at the application layer.
alter table public.hammerex_affiliates
  add column if not exists avatar_url text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists state_region text,
  add column if not exists bio text;
