-- Site Board — homeowner-facing pinboards for Site Interest images.
--
-- Ownership model (Philip 2026-07-16):
--   • MVP uses a cookie-scoped owner_key so anonymous visitors can
--     save images without a sign-up flow. The cookie stores an
--     opaque uuid; the API accepts it and checks it on every
--     write. Cross-device sync is deferred (needs real homeowner
--     auth, which doesn't exist yet).
--   • When homeowner auth ships later, boards with owner_key
--     matching a still-valid cookie can be migrated to the user's
--     account by rewriting owner_key = "homeowner:<slug>".
--
-- Public boards get a shareable URL — friends see the board but
-- can't add/remove items. Owner-only writes; anon reads on public.

create table if not exists public.hammerex_site_boards (
  id           uuid        primary key default gen_random_uuid(),
  owner_key    text        not null,   -- "cookie:<uuid>" or later "homeowner:<slug>"
  name         text        not null,
  slug         text        not null,   -- short random slug used in shareable URLs
  description  text,
  is_public    boolean     not null default true,
  cover_image_url text,                -- auto-set from first added item
  item_count   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists hammerex_site_boards_slug on public.hammerex_site_boards (slug);
create index if not exists hammerex_site_boards_owner on public.hammerex_site_boards (owner_key, created_at desc);

create table if not exists public.hammerex_site_board_items (
  id            uuid        primary key default gen_random_uuid(),
  board_id      uuid        not null references public.hammerex_site_boards(id) on delete cascade,
  image_url     text        not null,
  subject       text,
  -- Full snapshot of the InspirationImage at save-time so the
  -- board view can render exactly what the user pinned even if
  -- the source library entry is later removed / edited. Includes
  -- credit chip data so shared boards still show the submitter.
  source_json   jsonb       not null default '{}'::jsonb,
  note          text,
  added_at      timestamptz not null default now()
);

-- Prevent duplicate saves of the same image to the same board.
create unique index if not exists hammerex_site_board_items_unique
  on public.hammerex_site_board_items (board_id, image_url);

create index if not exists hammerex_site_board_items_board
  on public.hammerex_site_board_items (board_id, added_at desc);

-- Auto-touch board.updated_at + bump item_count on insert/delete
-- so the board list can sort by "recently added to" and show
-- accurate counts without a runtime aggregate.
create or replace function public.hammerex_site_boards_bump()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.hammerex_site_boards
      set item_count = item_count + 1,
          updated_at = now(),
          cover_image_url = coalesce(cover_image_url, new.image_url)
      where id = new.board_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.hammerex_site_boards
      set item_count = greatest(item_count - 1, 0),
          updated_at = now()
      where id = old.board_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_hammerex_site_board_items_bump on public.hammerex_site_board_items;
create trigger trg_hammerex_site_board_items_bump
  after insert or delete on public.hammerex_site_board_items
  for each row execute function public.hammerex_site_boards_bump();
