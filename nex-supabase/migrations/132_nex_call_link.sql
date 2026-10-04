-- ============================================================================
-- NEX-native Migration 132 · nex_call_link
-- ============================================================================
--
-- Shareable call-link records. A link lets its creator share one URL
-- that lands another authenticated NEX user in a 1:1 call with them.
-- Group-call links (3-4 participants via the mesh engine) use the
-- SAME table and are differentiated by max_uses > 1 (and the group
-- call session that the link spawns when first consumed).
--
-- Founder-sealed defaults 2026-10-04:
--   · Account-only joins (joiners must be signed in). No anonymous
--     guest flow in v1 · adding one requires separate consent /
--     abuse-prevention / rate-limit decisions.
--   · 24h default TTL via expires_at. Enforced at the service layer.
--   · max_uses defaults 1 (single-use link = classic 1:1 ring).
--     Group links set max_uses up to the mesh cap of 4.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '132';
--     DROP TABLE IF EXISTS nex_call_link CASCADE;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_call_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Short URL-safe identifier that appears in /nex-native/call/j/{slug}.
  -- Length 12 chars · 72 bits of entropy, no collisions in practice.
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9_-]{8,32}$'),
  created_by UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  -- Starting media kind when the link is consumed. Receivers can
  -- flip to video mid-call per existing PeerCall semantics.
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video')),
  -- How many unique accounts can consume this link before it stops
  -- accepting joins. 1 = classic 1:1 ring. 2-4 = group-sized link.
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 4),
  consumed_count INTEGER NOT NULL DEFAULT 0 CHECK (consumed_count >= 0),
  -- NULL = never expires (reserved · service layer forbids today).
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- For group links · when consumed_count reaches 1, we spin up a
  -- nex_group_call_session (migration 133) and store its id here so
  -- subsequent joins land in the SAME session rather than starting
  -- new ones.
  group_call_session_id UUID NULL,
  CONSTRAINT nex_call_link_consumed_le_max
    CHECK (consumed_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS nex_call_link_by_creator
  ON nex_call_link (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_call_link_by_slug
  ON nex_call_link (slug);

ALTER TABLE nex_call_link ENABLE ROW LEVEL SECURITY;

-- SELECT: the creator sees their own links. Everyone else gets the
-- row only via the server action that resolves a slug (which uses
-- the admin client · bypasses RLS). This keeps per-user discovery
-- scoped to the creator while allowing join flows to work.
CREATE POLICY nex_call_link_select_own
  ON nex_call_link FOR SELECT
  USING (
    created_by IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY nex_call_link_insert_own
  ON nex_call_link FOR INSERT
  WITH CHECK (
    created_by IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Creator can revoke · service layer sets revoked_at + updated_at.
CREATE POLICY nex_call_link_update_own
  ON nex_call_link FOR UPDATE
  USING (
    created_by IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    created_by IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- No DELETE policy · links are history too; revoked_at + expires_at
-- control effective life.

COMMENT ON TABLE nex_call_link IS
  'Shareable call-link records. v1 account-only joins, 24h TTL, max_uses 1-4. Group links spawn a nex_group_call_session on first join.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '132',
    'nex_call_link · shareable call links (1-4 participants)',
    'Phase 1 of group-calls build. Account-only joins. 24h default TTL. Group links fan into migration 133 sessions.'
  );

COMMIT;
