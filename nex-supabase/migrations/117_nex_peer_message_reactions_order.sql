-- Migration 117 · nex_peer_message.reactions_order · sealed 2026-10-01.
-- ---------------------------------------------------------------
-- Adds an insertion-ordered array of reaction emoji keys so the UI
-- can render the newest reaction as a large stamp overlapping the
-- bubble corner while older reactions demote to a small chip row.
-- Postgres JSONB does not preserve object key order, so we track the
-- order in a dedicated column instead of relying on the reactions
-- JSONB shape.
--
-- Semantics (enforced by peer-message-service.toggleMessageReaction):
--   · Append emoji to reactions_order when its account-id array
--     transitions 0 → 1 (first reactor picked it).
--   · Remove emoji from reactions_order when its account-id array
--     transitions N → 0 (last reactor removed it).
--   · Repeated toggles that don't change presence leave the array
--     untouched · so the "newest" slot survives micro-interactions.
--
-- Backwards compatible: existing rows initialise to '{}' which the
-- UI treats as "fall back to Object.keys(reactions)".

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS reactions_order text[] NOT NULL DEFAULT '{}';

-- Backfill: for any existing row that already has reactions, seed
-- reactions_order from the current keys so the big-stamp slot is
-- non-empty on day one. Idempotent · re-running is a no-op when the
-- column is already populated.
UPDATE nex_peer_message
SET reactions_order = ARRAY(SELECT jsonb_object_keys(reactions))
WHERE
  reactions IS NOT NULL
  AND jsonb_typeof(reactions) = 'object'
  AND reactions <> '{}'::jsonb
  AND (reactions_order IS NULL OR cardinality(reactions_order) = 0);
