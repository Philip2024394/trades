-- Xrated Trades — trust level (3–5) for premium trade profiles.
--
-- Every approved/live tradie starts at LEVEL 3 ("Verified") so new accounts
-- never feel penalised. Tradies climb to:
--   LEVEL 4 ("Trusted")    — insurance proof + qualifications uploaded
--   LEVEL 5 ("X-Rated Elite") — 10+ verified reviews ≥ 4.5★ sustained
--
-- Levels are a ONE-WAY ratchet — review failures route to internal
-- moderation (suspension or hidden badges), never a public demotion.
--
-- This column is an OVERRIDE for admin/moderation: NULL means "auto-derive
-- from current listing data" (the normal case). An integer 3, 4 or 5 means
-- admin pinned it (e.g., manual promotion before reviews flow exists).
alter table public.hammerex_trade_off_listings
  add column if not exists trust_level_override smallint;

-- Guard rails: only 3-5 are valid public levels. NULL → auto-derive.
alter table public.hammerex_trade_off_listings
  drop constraint if exists trust_level_override_range;
alter table public.hammerex_trade_off_listings
  add constraint trust_level_override_range
    check (trust_level_override is null or trust_level_override between 3 and 5);
