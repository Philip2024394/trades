-- ============================================================================
-- NEX-native Migration 103 · Bridge 99 · nex_welcome_outbox
-- ============================================================================
--
-- Sealed doctrine reference:
--   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
--   Sealed v5 · §Q8 Welcome Outbox founder-accepted 2026-09-30.
--   Sealed baseline: git commit 6566ace3.
--
-- Purpose:
--   Durable instruction store for NEX1 welcome delivery to provisional
--   accounts created by Bridge 99. Bridge 99's provisional-create
--   transaction inserts exactly one row here inside the atomic DB
--   transaction (sealed §7B, Part 5 of the Create paragraph). A separate
--   worker process claims rows with a lease-based at-least-once pattern,
--   delivers the welcome by sending a message from NEX1 to the
--   provisional account, and marks the row processed.
--
-- What this outbox IS:
--   A durable instruction: "NEX needs to send the NEX1 welcome action
--   for account X." The row is created atomically with the provisional
--   account so no post-commit crash can lose the intent.
--
-- What this outbox IS NOT:
--   The welcome message content. Message text lives in Bridge 62's
--   existing welcome generator and, once delivered, in nex_peer_message.
--   No plaintext (or ciphertext) message body is stored here.
--
-- Scoping (Q8 founder-accepted):
--   Bridge 99's provisional-create path is the ONLY writer of this
--   table. Bridge 62's existing inline welcome path (which fires for
--   non-provisional account creations elsewhere in the codebase) is
--   UNCHANGED and continues to operate as-is. This migration adds a
--   new table only — it does NOT ALTER, DROP, or trigger against any
--   existing Bridge 62 code or DB object. The two paths are physically
--   independent by construction.
--
-- Delivery semantics: at-least-once processing with
-- exactly-once message-insert effect.
--
--   Precise formulation (per founder review 2026-09-30):
--   The database can guarantee AT MOST ONE welcome message row for a
--   given (sender_account_id, send_intent_id). The outbox guarantees
--   AT LEAST ONE processing attempt until success or terminal failure.
--   Together, these compose to an exactly-once EFFECT on the message
--   insert, assuming the worker's transaction correctly treats a
--   unique-constraint conflict as "already delivered."
--
--   The system is NOT mathematically exactly-once end-to-end (a
--   permanent-failure terminal state can lose a welcome; that is an
--   operational choice, not a delivery-mechanism guarantee). The
--   precise phrasing is: "at-least-once processing with exactly-once
--   message-insert effect."
--
--   Two layers.
--   (1) At outbox level · UNIQUE (account_id) means each account gets
--       AT MOST ONE outbox instruction, EVER. Bridge 99 provisional-
--       create inserts exactly one row per account; any accidental
--       second insert is rejected at the DB level. No re-queue after
--       terminal state; if operations decide manual retry is needed,
--       that requires an explicit intervention (clear terminal state
--       + increment attempts).
--   (2) At message level · The worker uses outbox.id as the
--       send_intent_id when it inserts the welcome message row (via
--       the sendPeerMessage path with sender_account_id = NEX1). The
--       UNIQUE (sender_account_id, send_intent_id) constraint added by
--       Migration 102 Part C prevents duplicate welcome messages even
--       under worker crash-mid-delivery + reclaim + retry. If the
--       worker crashes AFTER inserting the message but BEFORE marking
--       the outbox processed, the next worker attempt tries to insert
--       the same (sender_account_id, send_intent_id) pair, hits the
--       UNIQUE constraint, treats it as "already delivered", and
--       marks the outbox processed.
--
-- At-least-once claim (worker leasing):
--   Worker atomically claims a row:
--     UPDATE nex_welcome_outbox
--        SET claimed_at = now(),
--            claimed_by = $worker_id,
--            lease_expires_at = now() + $lease_interval,
--            attempts = attempts + 1
--      WHERE id = (
--        SELECT id FROM nex_welcome_outbox
--         WHERE processed_at IS NULL
--           AND failed_at IS NULL
--           AND (claimed_at IS NULL OR lease_expires_at < now())
--           AND (next_attempt_after IS NULL OR next_attempt_after < now())
--         ORDER BY created_at ASC
--         LIMIT 1
--         FOR UPDATE SKIP LOCKED
--       )
--      RETURNING *;
--   If the worker crashes, lease_expires_at eventually passes and
--   another worker reclaims the row.
--
-- Access model:
--   RLS enabled with NO authenticated-role policies. Only service-role
--   (the welcome-outbox-worker) may read/write.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '103';
--     DROP TABLE IF EXISTS nex_welcome_outbox;
--   COMMIT;
--   (Note · rolling back drops all in-flight welcome instructions.
--    Any provisional account created between the drop and re-apply
--    will NOT receive a welcome unless manually re-queued.)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- nex_welcome_outbox · one instruction per provisional account, ever
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_welcome_outbox (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- Worker leasing (at-least-once + crash recovery)
  claimed_at            timestamptz NULL,
  claimed_by            text NULL,  -- opaque worker instance identifier for observability
  lease_expires_at      timestamptz NULL,

  -- Terminal states (mutually exclusive · at most one may be non-NULL)
  processed_at          timestamptz NULL,
  failed_at             timestamptz NULL,
  fail_reason           text NULL,

  -- Retry accounting
  attempts              int NOT NULL DEFAULT 0,
  last_attempt_error    text NULL,
  next_attempt_after    timestamptz NULL,

  -- Invariants ---------------------------------------------------------
  --
  -- Processed and failed are mutually exclusive terminal states; the
  -- row is either in-flight (both NULL), successfully delivered
  -- (processed_at NOT NULL), or permanently failed (failed_at NOT NULL).
  CONSTRAINT nex_welcome_outbox_terminal_exclusivity
    CHECK (processed_at IS NULL OR failed_at IS NULL),

  -- If failed_at is set, fail_reason must be set, and vice versa. No
  -- silent failures with no reason recorded.
  CONSTRAINT nex_welcome_outbox_fail_reason_consistency
    CHECK ((failed_at IS NULL) = (fail_reason IS NULL)),

  -- If a row is claimed, it has a lease expiry; if it is not claimed,
  -- it has no lease. Prevents half-set state that would confuse the
  -- worker reclaim path.
  CONSTRAINT nex_welcome_outbox_lease_consistency
    CHECK ((claimed_at IS NULL) = (lease_expires_at IS NULL)),

  -- Attempt counter is non-negative.
  CONSTRAINT nex_welcome_outbox_attempts_nonneg
    CHECK (attempts >= 0)
);

-- Outbox-level exactly-once: at most one instruction per account, ever.
-- Bridge 99 provisional-create inserts exactly one row. Any accidental
-- second insert (e.g. bug in a retry path) is rejected at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_welcome_outbox_account
  ON nex_welcome_outbox (account_id);

-- Worker claim path: find rows that are in-flight, not currently held
-- under a live lease, and eligible for a retry attempt (if scheduled).
-- The partial WHERE prunes terminal rows so the worker never re-scans
-- them.
CREATE INDEX IF NOT EXISTS idx_nex_welcome_outbox_claimable
  ON nex_welcome_outbox (created_at ASC)
  WHERE processed_at IS NULL AND failed_at IS NULL;

-- Observability: outstanding claims whose leases are about to expire
-- or already have. Feeds a "stuck welcome deliveries" ops dashboard
-- without scanning terminal rows.
CREATE INDEX IF NOT EXISTS idx_nex_welcome_outbox_lease
  ON nex_welcome_outbox (lease_expires_at)
  WHERE claimed_at IS NOT NULL
    AND processed_at IS NULL
    AND failed_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS · service-role only
-- ---------------------------------------------------------------------------

ALTER TABLE nex_welcome_outbox ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granted to authenticated role. Only
-- service-role (used exclusively by the welcome-outbox-worker) may
-- read/write. Clients never touch this table directly.

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE nex_welcome_outbox IS
  'Bridge 99 · Founder-sealed 2026-09-30 (Q8). Durable instruction store for NEX1 welcome delivery to provisional accounts. Written by Bridge 99 provisional-create inside the atomic account-create transaction (§7B). Read by the welcome-outbox-worker with lease-based at-least-once claim. Delivery semantics: at-least-once processing with exactly-once message-insert effect (composed of outbox-level UNIQUE (account_id) + message-level UNIQUE (sender_account_id, send_intent_id) via Migration 102 Part C, using outbox.id as the send_intent_id). Not mathematically exactly-once end-to-end: permanent-failure terminal state can lose a welcome by operational choice. Does NOT store message content. Access restricted to service-role (no authenticated-role RLS policies). Scoped to Bridge 99 provisional-create path only · Bridge 62 inline welcome path is unchanged.';

COMMENT ON COLUMN nex_welcome_outbox.id IS
  'Bridge 99. Outbox event identifier. The worker uses this value as the send_intent_id when it inserts the welcome message row via sendPeerMessage; that path is guarded by the UNIQUE (sender_account_id, send_intent_id) constraint from Migration 102 Part C, providing exactly-once message-insert effect even under worker crash + reclaim + retry (in combination with the outbox''s at-least-once processing).';

COMMENT ON COLUMN nex_welcome_outbox.account_id IS
  'Bridge 99. Provisional account that should receive the NEX1 welcome. UNIQUE across the table · at most one welcome instruction per account, ever. Cascades on nex_account delete (which happens at the 90-day provisional purge per §7B).';

COMMENT ON COLUMN nex_welcome_outbox.claimed_at IS
  'Bridge 99. Set by the worker when it claims the row for processing. Paired with lease_expires_at (both NULL or both non-NULL, enforced by CHECK). If the worker crashes, the lease expires and another worker reclaims.';

COMMENT ON COLUMN nex_welcome_outbox.processed_at IS
  'Bridge 99. Successful delivery marker. Mutually exclusive with failed_at. Once set, the row is terminal and the worker skips it in future scans.';

COMMENT ON COLUMN nex_welcome_outbox.failed_at IS
  'Bridge 99. Permanent-failure marker. Mutually exclusive with processed_at. Requires fail_reason to be set (enforced by CHECK). Manual intervention required to re-queue.';

-- ---------------------------------------------------------------------------
-- Migration ledger
-- ---------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '103',
    'Bridge 99 · nex_welcome_outbox · durable NEX1 welcome instruction store',
    'Founder-sealed doctrine 2026-09-30 · Q8 accepted (sealed baseline: git commit 6566ace3, docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md v5). Adds nex_welcome_outbox table scoped only to Bridge 99 provisional-create path. Bridge 62 inline welcome path UNCHANGED. Delivery semantics: at-least-once processing (lease-based worker claim) with exactly-once message-insert effect (outbox-level UNIQUE (account_id) + message-level UNIQUE (sender_account_id, send_intent_id) via Migration 102 Part C). Not mathematically exactly-once end-to-end: permanent-failure terminal state can lose a welcome by operational choice. No message content stored. RLS enabled, no authenticated policies (service-role only).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (run these SELECTs · not part of the migration):
--
--   -- Ledger row present
--   SELECT * FROM nex_migration_history WHERE version = '103';
--
--   -- Table exists
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'nex_welcome_outbox';
--   -- expect: one row
--
--   -- Columns
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'nex_welcome_outbox'
--    ORDER BY ordinal_position;
--   -- expect (in order): id, account_id, created_at, claimed_at, claimed_by,
--   --   lease_expires_at, processed_at, failed_at, fail_reason, attempts,
--   --   last_attempt_error, next_attempt_after
--
--   -- FK cascade behaviour
--   SELECT conname, pg_get_constraintdef(oid) AS def
--     FROM pg_constraint
--    WHERE conrelid = 'nex_welcome_outbox'::regclass AND contype = 'f';
--   -- expect: 1 row · REFERENCES nex_account(id) ON DELETE CASCADE
--
--   -- Every CHECK constraint present
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_welcome_outbox'::regclass AND contype = 'c'
--    ORDER BY conname;
--   -- expect: nex_welcome_outbox_attempts_nonneg,
--   --         nex_welcome_outbox_fail_reason_consistency,
--   --         nex_welcome_outbox_lease_consistency,
--   --         nex_welcome_outbox_terminal_exclusivity
--
--   -- Indexes (three: PK, unique account, claimable, lease)
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_welcome_outbox' ORDER BY indexname;
--   -- expect: idx_nex_welcome_outbox_claimable,
--   --         idx_nex_welcome_outbox_lease,
--   --         nex_welcome_outbox_pkey,
--   --         uq_nex_welcome_outbox_account
--
--   -- RLS enabled + zero authenticated policies
--   SELECT relrowsecurity FROM pg_class
--    WHERE relname = 'nex_welcome_outbox' AND relkind = 'r';
--   -- expect: true
--   SELECT count(*) FROM pg_policies WHERE tablename = 'nex_welcome_outbox';
--   -- expect: 0
--
--   -- Live CHECK proofs (savepoint-scoped, rolled back):
--   --   1. UNIQUE (account_id): insert two rows with same account_id → 2nd rejected.
--   --   2. terminal_exclusivity: try processed_at AND failed_at both set → rejected.
--   --   3. fail_reason_consistency: failed_at set with fail_reason NULL → rejected.
--   --   4. lease_consistency: claimed_at set with lease_expires_at NULL → rejected.
--   --   5. attempts_nonneg: attempts = -1 → rejected.
--
-- ============================================================================
