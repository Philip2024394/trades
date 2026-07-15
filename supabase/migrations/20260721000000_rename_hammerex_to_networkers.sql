-- Rename Site Interest / lead-capture tables from `hammerex_*` to
-- `networkers_*` prefix.
--
-- Rationale (Philip 2026-07-16): Thenetworkers is a separate app
-- from Hammerex — copied cart/product code inherited the hammerex_
-- prefix, but new tables authored specifically for the
-- Thenetworkers surface should not carry another app's brand in
-- their name.
--
-- Scope of THIS migration: only the 7 tables authored in the
-- 2026-07-16 batch (site interest, image submissions, lead
-- requests, site boards, visualise, featured placements). The
-- older shared tables (`hammerex_canteens`, `hammerex_canteen_posts`,
-- `hammerex_trade_off_listings`, etc.) are pre-existing across the
-- entire codebase and need a coordinated rename with a full-repo
-- find-replace + regression test — deferred to its own pass.
--
-- All statements idempotent via `alter table if exists`.

alter table if exists public.hammerex_canteen_saved_posts
  rename to networkers_canteen_saved_posts;

alter table if exists public.hammerex_image_submissions
  rename to networkers_image_submissions;

alter table if exists public.hammerex_lead_requests
  rename to networkers_lead_requests;

alter table if exists public.hammerex_site_boards
  rename to networkers_site_boards;

alter table if exists public.hammerex_site_board_items
  rename to networkers_site_board_items;

alter table if exists public.hammerex_visualise_requests
  rename to networkers_visualise_requests;

alter table if exists public.hammerex_featured_placements
  rename to networkers_featured_placements;

-- Auto-touch triggers were named with the old table names — rename
-- them + the functions they call so the metadata reads cleanly.
-- Wrapped in DO blocks so a missing object doesn't fail the batch.

do $$
begin
  if exists (select 1 from pg_proc where proname = 'hammerex_image_submissions_touch_updated_at') then
    alter function public.hammerex_image_submissions_touch_updated_at()
      rename to networkers_image_submissions_touch_updated_at;
  end if;
  if exists (select 1 from pg_proc where proname = 'hammerex_lead_requests_touch_updated_at') then
    alter function public.hammerex_lead_requests_touch_updated_at()
      rename to networkers_lead_requests_touch_updated_at;
  end if;
  if exists (select 1 from pg_proc where proname = 'hammerex_site_boards_bump') then
    alter function public.hammerex_site_boards_bump()
      rename to networkers_site_boards_bump;
  end if;
  if exists (select 1 from pg_proc where proname = 'hammerex_visualise_requests_touch') then
    alter function public.hammerex_visualise_requests_touch()
      rename to networkers_visualise_requests_touch;
  end if;
  if exists (select 1 from pg_proc where proname = 'hammerex_featured_placements_touch') then
    alter function public.hammerex_featured_placements_touch()
      rename to networkers_featured_placements_touch;
  end if;
end$$;
