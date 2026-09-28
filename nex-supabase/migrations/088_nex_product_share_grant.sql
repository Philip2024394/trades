-- ============================================================================
-- NEX-native Migration 088 · Bridge 49b-next · Product-share grant table
-- ============================================================================
--
-- Founder-sealed doctrine 2026-09-29:
--   · Sharing a NEX Direct Price product creates a GRANT · not a
--     credit balance · not a voucher code · just a row that says
--     "sharer + receiver may claim +N% off this product until
--     expires_at".
--   · Grants are NEX-internal only. Never external.
--   · Anti-spam · same (sharer, receiver_account_id, business_id)
--     cannot get a NEW grant within 7 days of the last one.
--     Same (sharer, receiver_group_id, business_id) same rule.
--   · Active-recipient rule · sharer picks a friend/group only from
--     accounts/groups with peer chat activity in the last 7 days
--     (enforcement lives in share-service · not DB · because the
--     "active" definition is behavioural not schema).
--
-- Adds:
--
--   nex_product_share_grant · one row per share event · used by both
--     ends when they reach checkout to see whether a discount grant
--     is still valid, and to mark it consumed on order-completion.
--
--   Extends nex_peer_message.attachment_type CHECK to allow
--     'product_share' · rendered as the B4 Swiss NEX Banner in the
--     recipient's chat feed.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '088';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (
--         attachment_type IS NULL OR attachment_type IN (
--           'image','video','audio','product','menu_item','cart_order'
--         )
--       );
--     DROP TABLE IF EXISTS nex_product_share_grant;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nex_product_share_grant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_product_share_grant (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_account_id         uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  receiver_account_id       uuid REFERENCES nex_account(id) ON DELETE CASCADE,
  receiver_group_id         uuid,
  business_id               uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  product_id                uuid REFERENCES nex_product(id) ON DELETE CASCADE,
  share_type                text NOT NULL
    CHECK (share_type IN ('friend','group')),
  sharer_bonus_pct          integer NOT NULL CHECK (sharer_bonus_pct BETWEEN 0 AND 20),
  receiver_bonus_pct        integer NOT NULL CHECK (receiver_bonus_pct BETWEEN 0 AND 20),
  personal_note             text
    CHECK (personal_note IS NULL OR length(personal_note) <= 200),
  expires_at                timestamptz NOT NULL,
  consumed_by_sharer_at     timestamptz,
  consumed_by_receiver_at   timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),

  -- Exactly ONE of the two targets must be set · schema-level guard.
  CHECK (
    (share_type = 'friend' AND receiver_account_id IS NOT NULL AND receiver_group_id IS NULL)
    OR
    (share_type = 'group'  AND receiver_group_id   IS NOT NULL AND receiver_account_id IS NULL)
  )
);

COMMENT ON TABLE nex_product_share_grant IS
  'One row per NEX Direct Price share event · records the sharer, the target (friend account or group), the product, the bonuses granted to both sides, and the 48hr (or seller-set) expiry. Consumed_* columns track when each side redeemed the grant during checkout. Bridge 49b-next sealed 2026-09-29.';

COMMENT ON COLUMN nex_product_share_grant.expires_at IS
  'Derived at insert time from ladder.share_expiry_hours · defaults to 48hr but seller may configure 1-168hr on their ladder.';

COMMENT ON COLUMN nex_product_share_grant.consumed_by_sharer_at IS
  'Set when the sharer places an order that applies this grant · one-shot · downstream cart calculators check this before re-applying.';

CREATE INDEX IF NOT EXISTS idx_nex_product_share_grant_sharer_business
  ON nex_product_share_grant (sharer_account_id, business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_product_share_grant_receiver_business
  ON nex_product_share_grant (receiver_account_id, business_id, created_at DESC)
  WHERE receiver_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_product_share_grant_group_business
  ON nex_product_share_grant (receiver_group_id, business_id, created_at DESC)
  WHERE receiver_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_product_share_grant_expires
  ON nex_product_share_grant (expires_at)
  WHERE consumed_by_sharer_at IS NULL OR consumed_by_receiver_at IS NULL;

ALTER TABLE nex_product_share_grant ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_product_share_grant_participant_read
  ON nex_product_share_grant
  FOR SELECT
  USING (
    sharer_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
    OR receiver_account_id IN (
      SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );
COMMENT ON POLICY nex_product_share_grant_participant_read ON nex_product_share_grant IS
  'Sharer and (for friend shares) the receiver can read their own grants · group receivers use the group-message read policy on nex_peer_message.';

-- ---------------------------------------------------------------------------
-- 2. nex_peer_message.attachment_type · allow 'product_share'
-- ---------------------------------------------------------------------------
ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      'image',
      'video',
      'audio',
      'product',
      'menu_item',
      'cart_order',
      'product_share'
    )
  );

COMMENT ON COLUMN nex_peer_message.attachment_type IS
  'image | video | audio | product | menu_item | cart_order | product_share ·
   client dispatches renderer. product_share carries the grant + banner
   metadata for the recipient · rendered as B4 Swiss NEX Banner.
   Sealed 2026-09-29 · Bridge 49b.';

-- ---------------------------------------------------------------------------
-- 3. Record this migration
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '088',
    'Bridge 49b · nex_product_share_grant + product_share attachment_type',
    'Founder-authorised 2026-09-29. NEX Direct Price viral-loop grant table · 7-day anti-spam (enforced in share-service) · active-recipient rule (also service-layer) · grants carry sharer + receiver bonuses + 48hr default expiry. Peer-chat attachment allows product_share for the B4 Swiss NEX Banner render.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_product_share_grant';
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'nex_peer_message_attachment_type_check';
