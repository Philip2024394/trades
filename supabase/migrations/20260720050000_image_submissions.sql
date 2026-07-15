-- Trade image submissions — moderation queue that feeds the public
-- Inspiration tab on /trade-off/search.
--
-- Separate from `hero_library` (admin-curated pool with rich
-- metadata: aspect_variants, theme_palette, hero_use_case). This
-- table is a lightweight submission stream that any trade can post
-- into from a canteen live-feed post. Admin flips status to
-- 'approved' via /admin/image-submissions and the row becomes
-- publicly searchable.
--
-- Design decisions (Philip 2026-07-16):
--   • Every submission carries submitter_slug + source_post_id +
--     source_canteen_id so approved images can credit the poster
--     back in the Inspiration UI ("this image has active comments,
--     view →") and route homeowner interest back to the original
--     trade's canteen — the source_post fields are the credit trail.
--   • Auto-quality gate runs at submit time (route handler). Rows
--     that pass hard checks land as 'auto_approved' and skip the
--     moderator queue; softer flags (low_resolution, missing_alt,
--     probable_watermark) land as 'pending' for human review.
--   • quality_flags is a text[] not enum — new gate rules can be
--     added without a migration.
--   • Rejected rows keep the row (never hard-delete) so admins can
--     see history and re-approve if the submitter re-uploads a
--     better crop; hard-delete only via admin GC job.

create table if not exists public.networkers_image_submissions (
  id                   uuid        primary key default gen_random_uuid(),
  submitter_slug       text        not null,
  submitter_display    text,
  submitter_avatar_url text,
  source_post_id       uuid        references public.hammerex_canteen_posts(id) on delete set null,
  source_canteen_id    uuid        references public.hammerex_canteens(id)      on delete set null,
  image_url            text        not null,
  alt_text             text,
  trade_slug           text,
  keywords             text[]      not null default '{}'::text[],
  status               text        not null default 'pending'
                                   check (status in ('pending', 'auto_approved', 'approved', 'rejected')),
  quality_score        int         not null default 0,
  quality_flags        text[]      not null default '{}'::text[],
  moderated_by         text,
  moderated_at         timestamptz,
  moderation_note      text,
  flag_count           int         not null default 0,
  view_count           int         not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One row per (image_url, submitter). Prevents accidental duplicates
-- when a trade re-shares the same image; if they want a variant,
-- they need a new image_url.
create unique index if not exists networkers_image_submissions_url_submitter
  on public.networkers_image_submissions (image_url, submitter_slug);

-- Moderator queue lookup: pending first, oldest first (FIFO fairness).
create index if not exists networkers_image_submissions_queue
  on public.networkers_image_submissions (status, created_at)
  where status in ('pending', 'auto_approved');

-- Public search lookup: only approved rows surface in Inspiration.
-- Keyword-array GIN so `where 'loft ladders' = any(keywords)` is fast.
create index if not exists networkers_image_submissions_approved_keywords
  on public.networkers_image_submissions using gin (keywords)
  where status in ('approved', 'auto_approved');

-- Submitter credit lookup: "show me all approved images by trade X".
create index if not exists networkers_image_submissions_submitter
  on public.networkers_image_submissions (submitter_slug, status);

-- Auto-touch updated_at on any UPDATE so `order by updated_at` in
-- the admin UI reflects the most-recently-moderated first.
create or replace function public.networkers_image_submissions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_networkers_image_submissions_touch on public.networkers_image_submissions;
create trigger trg_networkers_image_submissions_touch
  before update on public.networkers_image_submissions
  for each row execute function public.networkers_image_submissions_touch_updated_at();
