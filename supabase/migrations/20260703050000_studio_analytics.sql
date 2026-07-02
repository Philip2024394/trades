-- Studio analytics — extend studio_layout_events for section-instance
-- tracking + visitor de-duplication.
--
-- Adds:
--   instance_id      — the per-page section instance id (uuid or slug),
--                      so we can tell 'hero A' from 'hero B' when both
--                      use hero/plantHireBold
--   visitor_hash     — SHA-derived pseudonymous visitor id set by the
--                      beacon; used for scroll-depth dedupe and later
--                      A/B bucketing. Not the raw cookie.
--   variant_bucket   — 'A' or 'B' when an experiment is running on this
--                      instance. NULL when no experiment.
--   experiment_id    — FK-ish (text so it can be a slug) tying events to
--                      an experiment. NULL when no experiment.
--
-- All new columns are NULLABLE so existing writers keep working and old
-- rows stay valid.

alter table public.studio_layout_events
  add column if not exists instance_id text,
  add column if not exists visitor_hash text,
  add column if not exists variant_bucket text,
  add column if not exists experiment_id text;

-- Hot index for the analytics dashboard: per-brand / per-page rollups
-- filtered by event type over a recent time window.
create index if not exists studio_layout_events_brand_page_event_idx
  on public.studio_layout_events
     (brand_id, page_id, event, created_at desc);

-- Hot index for scroll-depth / view dedupe by visitor.
create index if not exists studio_layout_events_visitor_event_idx
  on public.studio_layout_events
     (visitor_hash, event, created_at desc);

-- Bucket check — enforce the A/B contract cheaply at the schema level.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'studio_layout_events_bucket_check'
  ) then
    alter table public.studio_layout_events
      add constraint studio_layout_events_bucket_check
      check (variant_bucket is null or variant_bucket in ('A', 'B'));
  end if;
end$$;
