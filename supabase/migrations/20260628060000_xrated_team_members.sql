-- Xrated Trades — "Meet the team" roster stored on the listing itself.
-- Each element: { name, role, years_experience, avatar_url, skills[] }.
-- Component (TeamGrid.tsx) hides the section unless the array has >= 2
-- members, so solo tradespeople can leave this empty/[].
alter table public.hammerex_trade_off_listings
  add column if not exists team_members jsonb not null default '[]'::jsonb;
