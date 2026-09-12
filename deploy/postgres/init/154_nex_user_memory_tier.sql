-- 154_nex_user_memory_tier.sql
--
-- NEX L2M-TIERED · three-tier long-term memory · Phase L2M-T2 · Migration 154.
-- Founder Path A · 2026-09-09.
--
-- Adds `tier` column to nex.user_memory per Redis long-term memory
-- architecture (semantic · episodic · procedural) referenced in the
-- architecture research report P6.
--
-- Doctrine #4 unchanged: no tier converts memory into truth. All
-- three tiers still flow through PersonalizationContext, never
-- EvidenceItem.

CREATE SCHEMA IF NOT EXISTS nex;

ALTER TABLE nex.user_memory
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'semantic';

-- Ensure existing rows carry the default (redundant with the DEFAULT
-- clause but explicit for readers of this migration).
UPDATE nex.user_memory SET tier = 'semantic' WHERE tier IS NULL;

ALTER TABLE nex.user_memory
  DROP CONSTRAINT IF EXISTS user_memory_tier_bounds;
ALTER TABLE nex.user_memory
  ADD CONSTRAINT user_memory_tier_bounds
  CHECK (tier IN ('semantic', 'episodic', 'procedural'));

-- Recall-ranking index: user + tier + recency.
CREATE INDEX IF NOT EXISTS idx_nex_user_memory_tier_recent
  ON nex.user_memory (user_id, tier, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN nex.user_memory.tier IS
  'Founder L2M-Tiered · semantic (timeless facts) · episodic (time-indexed events) · procedural (learned procedures). Doctrine #4 · never becomes EvidenceItem regardless of tier.';
