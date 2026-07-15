-- Canteen saved posts (bookmarks) — protects a post from the 30-post
-- auto-rotation on its canteen.
--
-- Design decisions (2026-07-15):
--   - Save is per-user. Each (post, saver) pair is one row. Any single
--     save is enough to exempt the post from rotation — "if anyone
--     has bookmarked it, the feed keeps it."
--   - No cascade to the saver's merchant profile — saver_slug is just
--     a string reference, deliberately loose. Deleting a merchant
--     doesn't kill their saves; the row survives and continues to
--     exempt the post. That's fine — saved bookmarks are a reader's
--     signal, not owner metadata.
--   - Cascade on post delete: when the parent post is destroyed
--     (owner delete, moderation) every save vanishes with it.
--   - RLS lives in the API layer today — every save/unsave goes
--     through /api/canteens/posts/[id]/save which authenticates via
--     getMerchantIdentity(). If direct client → PostgREST reads land
--     later, add explicit policies.

create table if not exists public.networkers_canteen_saved_posts (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references public.hammerex_canteen_posts(id) on delete cascade,
  canteen_id  uuid        not null references public.hammerex_canteens(id) on delete cascade,
  saver_slug  text        not null,
  created_at  timestamptz not null default now()
);

-- One row per (post, saver). Toggling save re-uses the same row.
create unique index if not exists networkers_canteen_saved_posts_unique
  on public.networkers_canteen_saved_posts (post_id, saver_slug);

-- Fast "which posts in this canteen are saved?" lookup for the
-- rotation query — the create-post endpoint reads this to decide
-- which posts are exempt when trimming past 30.
create index if not exists networkers_canteen_saved_posts_canteen_post
  on public.networkers_canteen_saved_posts (canteen_id, post_id);

-- Fast "which posts has this saver bookmarked?" lookup — feed shell
-- loads initial saved set for the signed-in viewer on page render.
create index if not exists networkers_canteen_saved_posts_saver
  on public.networkers_canteen_saved_posts (saver_slug, canteen_id);
