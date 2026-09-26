-- ============================================================================
-- NEX-native Migration 005 · nex_order + nex_order_event
-- ============================================================================
--
-- Purpose:
--   The commerce object. An order references customer + business + product
--   + optionally a source conversation. Price and currency are SNAPSHOTTED
--   at order-creation time so later product-record changes never rewrite
--   history. Order events give an immutable state-transition audit trail.
--
-- Doctrine references:
--   · Identity Doctrine · customer_account_id / business_id / product_id
--     are UUID FKs · never phone/email
--   · Commercial Doctrine · orders belong to Layer C (Commerce Ledger)
--     · separate from Wallet · no lead-marketplace exposure
--   · Build Order · orders are real persisted records · Founder Test
--     acceptance requires the chain to be retrievable end-to-end
--
-- Idempotency (Founder-signed 2026-09-24):
--   nex_order.idempotency_key is a nullable UNIQUE text column. Client may
--   supply a stable key per attempt (e.g. UUID from the client) so that
--   network retries do NOT silently create duplicate commerce. Server
--   catches unique-violation on INSERT · returns the existing row. When
--   idempotency_key is NULL, no dedup happens (caller accepts risk).
--
-- Immutability:
--   nex_order_event rows are IMMUTABLE after INSERT · state transitions
--   are recorded as new events · never mutation of prior events.
--   nex_order.state is mutable (transitions written by service layer under
--   controlled boundary · every transition ALSO writes an event row).
--
-- FK behaviour:
--   customer_account_id → RESTRICT (orders reference stable customer)
--   business_id → RESTRICT (orders reference stable business)
--   product_id → RESTRICT (orders reference stable product ·
--                          product archival preserved via status='archived')
--   source_conversation_id → SET NULL (nullable · conversation may be
--                             deleted without invalidating the order)
--   order_event.order_id → RESTRICT (events tied to their order)
--   order_event.actor_account_id → SET NULL (system events have no actor
--                                   · account deletion doesn't lose the
--                                   audit fact of "someone acted")
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '005';
--     DROP TABLE IF EXISTS nex_order_event;
--     DROP TABLE IF EXISTS nex_order;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. nex_order
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_order (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id      uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  business_id              uuid NOT NULL REFERENCES nex_business(id) ON DELETE RESTRICT,
  product_id               uuid NOT NULL REFERENCES nex_product(id) ON DELETE RESTRICT,
  source_conversation_id   uuid REFERENCES nex_conversation(id) ON DELETE SET NULL,

  -- Order state · monotonic-ish lifecycle · reversal happens via ledger,
  -- not by rewriting state history (state is mutable but every transition
  -- writes an order_event row).
  state                    text NOT NULL DEFAULT 'created'
                             CHECK (state IN ('created', 'pending', 'paid', 'completed', 'cancelled', 'refunded')),

  -- Frozen snapshots · captured at INSERT · NEVER updated after creation.
  -- Ensures historical orders survive product-record price/currency changes.
  price_pence              bigint NOT NULL CHECK (price_pence >= 0),
  currency                 text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),

  -- Idempotency · nullable UNIQUE. When set, prevents duplicate order
  -- creation from client retries. When NULL, no dedup.
  idempotency_key          text UNIQUE,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_order IS
  'Commerce record. All relationships are NEX-native UUIDs. Price + currency snapshotted at creation · never rewritten. Idempotency via nullable UNIQUE idempotency_key.';

COMMENT ON COLUMN nex_order.price_pence IS
  'Frozen snapshot of product price at order creation time · bigint minor units · never updated.';

COMMENT ON COLUMN nex_order.idempotency_key IS
  'Optional client-supplied stable key per creation attempt. UNIQUE prevents duplicate orders from retries. Server catches unique_violation → returns existing row.';

CREATE INDEX IF NOT EXISTS idx_nex_order_customer_account_id
  ON nex_order (customer_account_id);

CREATE INDEX IF NOT EXISTS idx_nex_order_business_id
  ON nex_order (business_id);

CREATE INDEX IF NOT EXISTS idx_nex_order_product_id
  ON nex_order (product_id);

CREATE INDEX IF NOT EXISTS idx_nex_order_source_conversation_id
  ON nex_order (source_conversation_id)
  WHERE source_conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_order_state
  ON nex_order (state);

CREATE TRIGGER trg_nex_order_touch_updated_at
  BEFORE UPDATE ON nex_order
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. nex_order_event
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_order_event (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES nex_order(id) ON DELETE RESTRICT,
  event              text NOT NULL CHECK (length(trim(event)) > 0),
    -- e.g. 'created' · 'paid' · 'completed' · 'ledger_posted' · 'cancelled' · 'refunded'
    -- Free-form so future event types don't require schema migration.
  actor_account_id   uuid REFERENCES nex_account(id) ON DELETE SET NULL,
    -- Nullable · system events (e.g. cron-triggered state transitions) have no actor.
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_order_event IS
  'Immutable per-order event trail · every state transition writes here · reversal creates NEW events · never mutation of prior events.';

CREATE INDEX IF NOT EXISTS idx_nex_order_event_order_id_created_at
  ON nex_order_event (order_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE nex_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_order_event ENABLE ROW LEVEL SECURITY;

-- nex_order · customer reads own · business owner reads own business's orders
CREATE POLICY nex_order_customer_read
  ON nex_order
  FOR SELECT
  TO authenticated
  USING (
    customer_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    OR business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- nex_order · customer can INSERT orders where they are the customer
CREATE POLICY nex_order_customer_insert
  ON nex_order
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- nex_order · UPDATE is service-role only · state transitions are governed
-- (no policy for authenticated · service-role bypasses RLS).

-- nex_order_event · read alongside its order
CREATE POLICY nex_order_event_read
  ON nex_order_event
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM nex_order o
      WHERE o.customer_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
         OR o.business_id IN (
              SELECT b.id FROM nex_business b
              JOIN nex_account a ON a.id = b.owner_account_id
              WHERE a.supabase_user_id = auth.uid()
            )
    )
  );

-- NO INSERT/UPDATE/DELETE for authenticated on nex_order_event · service-role only.

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('005', 'nex_order + nex_order_event · price/currency snapshotted · idempotency_key UNIQUE nullable · immutable events · state transitions service-role only', 'Idempotency prevents duplicate commerce from retries. Reversal creates new events + new ledger entries · never mutation.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '005';
--   SELECT count(*) FROM nex_order;
--   SELECT count(*) FROM nex_order_event;
--   SELECT tablename, policyname FROM pg_policies
--     WHERE tablename IN ('nex_order','nex_order_event')
--     ORDER BY tablename, policyname;
