-- Video gallery — support a right-side image slot as well as the
-- main left carousel. Used on the concrete video (materials
-- product shot) and on any trade video where a supporting visual
-- adds context to the chip list.

alter table hammerex_video_gallery
  add column if not exists position text not null default 'left'
    check (position in ('left','right'));

comment on column hammerex_video_gallery.position is
  '''left'' = primary carousel slot with lightbox. ''right'' = supporting image at top of the right-side info container. Multiple per video allowed for either.';
