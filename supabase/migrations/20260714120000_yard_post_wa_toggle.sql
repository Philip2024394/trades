-- Per-post WhatsApp-reply toggle.
--
-- Yard posts default to "WhatsApp replies allowed" (true) so the
-- existing behaviour is unchanged for every existing row. The post
-- author can flip it off from the ⋯ menu when they're getting spammed
-- (a viral job callout, a hot boiler-repair thread). When off, the
-- "Reply on WhatsApp" footer is hidden on every comment card for that
-- post — commenters can still leave in-app comments.
--
-- See ADR-0014 (upcoming) for the design rationale.

alter table hammerex_trade_off_yard_posts
  add column if not exists whatsapp_replies_enabled boolean not null default true;

comment on column hammerex_trade_off_yard_posts.whatsapp_replies_enabled
  is 'When false, the "Reply on WhatsApp" footer is hidden on this post. In-app comments still work. OP-only toggle via PATCH /api/trade-off/yard/posts/[id]/wa-toggle.';
