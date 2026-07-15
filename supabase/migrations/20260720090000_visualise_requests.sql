-- Site Interest AI Visualise requests.
--
-- The bolt-on button on every Site Interest card fires a request
-- into this table: room photo + source (inspiration) image + a
-- pending status. Real AI generation is wired in a follow-up pass
-- (worker picks up pending rows, calls the model, writes the
-- rendered_url back and flips status → complete).
--
-- Design constraints (Philip 2026-07-16):
--   • Credits are non-refundable — no refund endpoint ships.
--     See feedback_ai_visualiser_expectations_and_no_refunds.md.
--   • Anonymous submissions are OK (owner_key cookie same shape
--     as siteBoards) — real accounts can migrate later.
--   • Rate limit at endpoint level (owner_key + IP), not table
--     constraint.

create table if not exists public.hammerex_visualise_requests (
  id                  uuid        primary key default gen_random_uuid(),
  owner_key           text        not null,   -- "cookie:<uuid>" or "homeowner:<slug>"
  source_image_url    text        not null,   -- the Site Interest image the user wanted to visualise
  source_post_id      uuid        references public.hammerex_canteen_posts(id) on delete set null,
  source_canteen_id   uuid        references public.hammerex_canteens(id)      on delete set null,
  target_trade_slug   text,                   -- the credit-chip trade for eventual lead handoff
  room_photo_url      text        not null,   -- the user's uploaded room photo (Supabase Storage)
  prompt_note         text,                   -- optional short tweak from the user
  status              text        not null default 'queued'
                                    check (status in ('queued', 'processing', 'complete', 'failed')),
  rendered_url        text,                   -- populated when status = 'complete'
  failure_reason      text,
  credit_consumed     boolean     not null default true,
  ip_address          inet,
  user_agent          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists hammerex_visualise_requests_owner
  on public.hammerex_visualise_requests (owner_key, created_at desc);
create index if not exists hammerex_visualise_requests_queue
  on public.hammerex_visualise_requests (status, created_at)
  where status in ('queued', 'processing');
create index if not exists hammerex_visualise_requests_rate_ip
  on public.hammerex_visualise_requests (ip_address, created_at desc);

-- Storage bucket for room photos + rendered outputs. Public read
-- (URLs shared back to the user), service-role writes only.
insert into storage.buckets (id, name, public)
values ('visualise-photos', 'visualise-photos', true)
on conflict (id) do nothing;

-- Auto-touch updated_at
create or replace function public.hammerex_visualise_requests_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hammerex_visualise_requests_touch on public.hammerex_visualise_requests;
create trigger trg_hammerex_visualise_requests_touch
  before update on public.hammerex_visualise_requests
  for each row execute function public.hammerex_visualise_requests_touch();
