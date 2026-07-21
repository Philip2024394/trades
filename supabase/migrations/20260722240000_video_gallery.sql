-- Networkers TV — per-video reference gallery.
--
-- Videos can have supplementary example images below the player
-- (e.g. under a stone-effect rendering video, show 4-6 examples
-- of ashlar patterns homeowners could ask for). Distinct from
-- video thumbnail (the play-button preview) — these are
-- decorative/inspiration/reference images.
--
-- Every image is stored in Supabase Storage (auto-migrated from
-- ImageKit via imagekitMigrate.ts).

create table if not exists hammerex_video_gallery (
  id           uuid primary key default gen_random_uuid(),
  video_id     uuid not null references hammerex_videos(id) on delete cascade,
  image_url    text not null,
  caption      text,
  alt_text     text,
  credit       text,       -- "Plasterer Name" or "AI-generated example" — attribution
  disclaimer   text,       -- e.g. "Small sample only — each trade has their own designs"
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_video_gallery_video on hammerex_video_gallery(video_id, sort_order);
