-- Migration 095 · display_name length CHECK · Bridge 80
-- ---------------------------------------------------------------
-- Founder direction 2026-09-29: users pick their own display name
-- (username) freely — emoji allowed, only length is controlled. The
-- schema had display_name NOT NULL but with no CHECK on length, so
-- clients could store 0 chars or a 1MB blob.
--
-- Range chosen:
--   · min 2 chars · single-char names read as accidental
--   · max 40 chars (Unicode code points via char_length) · long
--     enough for "Aisha · Vintage Cameras 📷" style, short enough to
--     render in chat bubbles and identity headers without truncation
--
-- Emoji are counted as one code point each by char_length, so
-- "Nex 😊✨" is 6 chars — well within range. No character-set filter
-- so any Unicode grapheme (including flags, ZWJ sequences, kaomoji,
-- Bahasa Indonesia scripts) is accepted.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'nex_account_display_name_length_check'
      and conrelid = 'nex_account'::regclass
  ) then
    alter table nex_account drop constraint nex_account_display_name_length_check;
  end if;
end $$;

alter table nex_account
  add constraint nex_account_display_name_length_check
    check (char_length(display_name) between 2 and 40);

comment on constraint nex_account_display_name_length_check on nex_account is
  'Bridge 80 · Sealed 2026-09-29. Display name is 2..40 Unicode code points. Emoji + Bahasa + any script allowed · only length is bounded so bubbles + identity headers render predictably.';
