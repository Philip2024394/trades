-- One profile image, used everywhere.
--
-- Problem: avatar_url was stored in two tables:
--   1. hammerex_trade_off_listings.avatar_url  (canonical merchant row)
--   2. hammerex_canteen_members.avatar_url     (denormalised copy per canteen membership)
-- When a merchant updated their profile photo, only the first table
-- got the new URL — the second stayed on the old photo. Result: Mike
-- shows the new photo on Yard post cards but the old photo on his
-- canteen page. One person, two photos. Confusing.
--
-- Fix: a Postgres trigger that mirrors any change to the canonical
-- listings.avatar_url onto every matching canteen_members row. Also
-- runs a one-time backfill so existing drifted rows converge.
--
-- After this migration lands, the merchant profile editor can keep
-- writing to listings.avatar_url alone — the trigger fans out.

-- ─── One-time backfill ───────────────────────────────────
-- For every canteen_members row where the listing row exists and the
-- listing has an avatar_url, adopt it. Preserves any manual override
-- ONLY when the listing itself has no avatar_url (edge case: a
-- canteen row seeded before the listing had one).

update hammerex_canteen_members m
   set avatar_url = l.avatar_url
  from hammerex_trade_off_listings l
 where m.member_slug = l.slug
   and l.avatar_url is not null
   and l.avatar_url <> ''
   and coalesce(m.avatar_url, '') <> l.avatar_url;

-- ─── Trigger function ────────────────────────────────────
-- Mirrors avatar_url from listings → members whenever the listing
-- avatar changes. Uses member_slug as the join key (canonical link
-- between the two tables). SECURITY DEFINER so the trigger owner can
-- write to canteen_members regardless of the calling merchant's grant.

create or replace function hammerex_sync_avatar_url_to_members()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only fire when the avatar actually changed. Empty-string writes
  -- and null writes both propagate (clearing the photo is valid too).
  if new.avatar_url is distinct from old.avatar_url then
    update hammerex_canteen_members
       set avatar_url = new.avatar_url
     where member_slug = new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists hammerex_sync_avatar_url_trigger on hammerex_trade_off_listings;

create trigger hammerex_sync_avatar_url_trigger
  after update of avatar_url on hammerex_trade_off_listings
  for each row
  execute function hammerex_sync_avatar_url_to_members();

comment on function hammerex_sync_avatar_url_to_members()
  is 'Fans out avatar_url changes from hammerex_trade_off_listings to hammerex_canteen_members so the merchant has one profile image across every surface. See migration 20260714130000.';
