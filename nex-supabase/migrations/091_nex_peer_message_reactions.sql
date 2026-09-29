-- Migration 091 · Peer message reactions · Bridge 66 · sealed 2026-09-29
-- ---------------------------------------------------------------------------
-- Message-level emoji reactions on peer chat bubbles. Every modern
-- messenger has them (WhatsApp / iMessage / Slack / Discord /
-- Telegram) · NEX shipping without them would feel dated.
--
-- Design:
--   · Single JSONB column on nex_peer_message · shape:
--     { "❤️": ["<account_id>", ...], "👍": ["<account_id>", ...] }
--   · Empty object {} = no reactions · never NULL (default {})
--   · Simpler than a junction table for MVP · aggregates naturally ·
--     one row = one message = all its reactions
--   · Adds ~200 bytes/message max (6 emojis × ~35 char id + wrapping)
--   · No foreign-key enforcement on the account_ids inside the JSON ·
--     if an account is deleted their reaction stays as an orphan id ·
--     acceptable for MVP · a periodic sweep can clean these later
--
-- Server side (peer-message-service):
--   · toggleMessageReaction(messageId, callerId, emoji) reads current
--     JSONB, adds/removes callerId from the emoji array, writes back
--   · RLS: caller must be a participant in the conversation
--
-- Client side (message-bubble render):
--   · Long-press bubble → floating reaction row of 6 quick emojis
--   · Tap emoji → attach · re-tap same emoji → remove
--   · Below-bubble chip renders each emoji + count
--   · Tap chip to toggle (equivalent to tapping the emoji in picker)

alter table nex_peer_message
  add column if not exists reactions jsonb not null default '{}'::jsonb;

create index if not exists nex_peer_message_reactions_idx
  on nex_peer_message using gin (reactions)
  where reactions <> '{}'::jsonb;

comment on column nex_peer_message.reactions is
  'Bridge 66 · Sealed 2026-09-29. Emoji → [account_id, ...] map. Toggle via peer-message-service.toggleMessageReaction which mutates the JSONB atomically. Default {} · never NULL. GIN index partial (only non-empty rows) for future reverse lookups.';
