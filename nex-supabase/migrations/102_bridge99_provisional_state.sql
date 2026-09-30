-- ============================================================================
-- NEX-native Migration 102 · Bridge 99 · Provisional account state + risk +
--                                          session registry + idempotency
-- ============================================================================
--
-- Sealed doctrine reference:
--   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
--   Sealed v5 · §16 doctrine approved by founder 2026-09-30.
--   Sealed baseline: git commit 6566ace3.
--
-- Founder-resolved boundaries during pre-implementation reconnaissance
-- (2026-09-30, evidence-based session decisions · sealed doctrine NOT
--  modified in any way, this migration implements the sealed intent):
--
--   Boundary #1  · sender_account_id (not sender_id): sealed §5 Part C
--                  uses "sender_id" but the live column has always been
--                  "sender_account_id" (migration 047). Founder-resolved
--                  as a naming clarification against the live schema; no
--                  doctrine amendment. Part C below uses
--                  UNIQUE (sender_account_id, send_intent_id).
--
--   Boundary #2  · Session registry lives here as Part E, not in a
--                  separate migration. Sealed §7 requires a server-side
--                  session registry for per-jti revocation; §5 was
--                  silent on WHERE. Founder chose Part E to keep the
--                  Bridge 99 core schema in one file.
--
--   Boundary #3  · Bridge 3 peer_message RLS defect is NOT repaired in
--                  Bridge 99. Migration 047 RLS policies compare
--                  nex_account.id (participant/sender FKs) against
--                  auth.uid() (Supabase user id) — different UUIDs by
--                  construction, so the policies cannot fire. Production
--                  routes every peer_message operation through the
--                  service-role via nexSupabaseAdmin, and participant
--                  enforcement lives in peer-message-service.ts (see
--                  sendPeerMessage lines 324-331 and sendEncryptedPeerMessages
--                  lines 579-585). Founder decision: keep Bridge 3 RLS
--                  untouched; §13.6 acceptance test targets the real
--                  authorization boundary (service-layer participant
--                  check); RLS hardening is filed as a separate
--                  follow-up bridge (B99+rls-harden). Sealed doctrine
--                  wording is not rewritten.
--
--   Boundary #4  · NexAppSession | ProvisionalSession union type is
--                  introduced at implementation time. Mechanical
--                  latitude only. No doctrine amendment.
--
-- Structural summary (Parts A-E · in one atomic transaction):
--
--   Part A · nex_account.claimed_at                    (identity lifecycle)
--   Part B · nex_peer_conversation.origin_cover_business_id (provenance)
--   Part C · nex_peer_message.send_intent_id + unique   (idempotency)
--   Part D · nex_account_risk_signal (new table)        (risk-owned)
--   Part E · nex_session_registry (new table)           (session revocation)
--
-- Nothing in this migration touches Bridge 3 (nex_peer_conversation,
-- nex_peer_message) RLS. That is out-of-scope by founder direction and
-- lives in the B99+rls-harden follow-up.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '102';
--     DROP TABLE IF EXISTS nex_session_registry;
--     DROP TABLE IF EXISTS nex_account_risk_signal;
--     ALTER TABLE nex_peer_message  DROP COLUMN IF EXISTS send_intent_id;
--     ALTER TABLE nex_peer_conversation DROP COLUMN IF EXISTS origin_cover_business_id;
--     ALTER TABLE nex_account DROP COLUMN IF EXISTS claimed_at;
--   COMMIT;
--   (Note · rolling back drops Bridge 99 identity lifecycle state and
--    invalidates every provisional account and every issued nex_session
--    cookie. Only roll back if the whole First Conversation Principle
--    feature is being reverted.)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part A · nex_account.claimed_at
-- ---------------------------------------------------------------------------
-- The identity lifecycle column. NULL = provisional (born from a first
-- Send on a NEX Cover, no personal attributes claimed). timestamptz =
-- the moment the user claimed the account via /settings/profile.
--
-- Same nex_account row ID flows through every downstream FK. Provisional
-- vs claimed is a lifecycle STATE, not a class of account. There is no
-- parallel "provisional" table. This matters: RLS, foreign keys,
-- reporting, and account joins all keep working across the claim
-- boundary.

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz NULL;

-- Index unclaimed rows so the idle-expiry cron in §7B and the
-- founder-visible "provisional accounts" admin surface are cheap.
CREATE INDEX IF NOT EXISTS idx_nex_account_unclaimed
  ON nex_account (created_at DESC)
  WHERE claimed_at IS NULL;

COMMENT ON COLUMN nex_account.claimed_at IS
  'Bridge 99 · Founder-sealed 2026-09-30. NULL = provisional identity created by a first message from a NEX Cover · timestamp = user claimed via /settings/profile. Same schema, same FKs downstream · provisional vs claimed is a lifecycle state.';

-- ---------------------------------------------------------------------------
-- Part B · nex_peer_conversation.origin_cover_business_id
-- ---------------------------------------------------------------------------
-- Conversation PROVENANCE, not identity attribution. Founder v3/v4
-- review moved this off nex_account: a person can converse with many
-- businesses over time, and marking their identity permanently by "the
-- first business they messaged" is behavioural-profile flavour we do
-- not want. Each conversation carries its own origin.
--
-- NULL for conversations that did not originate on a cover (e.g. two
-- friends messaging from within the app). Set on create for
-- cover-originated conversations · never mutated after that.

ALTER TABLE nex_peer_conversation
  ADD COLUMN IF NOT EXISTS origin_cover_business_id uuid NULL
    REFERENCES nex_business(id) ON DELETE SET NULL;

-- Growth analytics: "conversations originated from cover X in period Y".
CREATE INDEX IF NOT EXISTS idx_nex_peer_conversation_origin_cover
  ON nex_peer_conversation (origin_cover_business_id, created_at DESC)
  WHERE origin_cover_business_id IS NOT NULL;

COMMENT ON COLUMN nex_peer_conversation.origin_cover_business_id IS
  'Bridge 99 · Founder-sealed 2026-09-30. The cover a conversation was born from (set on cover-originated creates · never mutated · NULL for conversations that did not originate on a cover). Conversation-scoped provenance, not identity attribution. Aggregate this column to attribute growth by cover.';

-- ---------------------------------------------------------------------------
-- Part C · nex_peer_message.send_intent_id + UNIQUE
-- ---------------------------------------------------------------------------
-- Client-generated UUID accompanying every first-message POST.
-- Server-side unique constraint makes double-tap Send, network retries,
-- and page-refresh races idempotent at the DATABASE level, not just at
-- the UI level. UI button-disabling can lose the race; the unique
-- constraint cannot.
--
-- Column name resolution: sealed §5 Part C uses UNIQUE (sender_id,
-- send_intent_id). The live nex_peer_message column has always been
-- sender_account_id (migration 047). Founder-resolved as a naming
-- clarification, not a doctrine change. This migration uses the actual
-- column name.
--
-- Nullable for historical rows that predate Bridge 99. The partial
-- unique index only enforces uniqueness where send_intent_id is set.

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS send_intent_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_peer_message_send_intent
  ON nex_peer_message (sender_account_id, send_intent_id)
  WHERE send_intent_id IS NOT NULL;

COMMENT ON COLUMN nex_peer_message.send_intent_id IS
  'Bridge 99. Client-generated UUID · unique per intent-to-send · enables server-side idempotent upsert for double-tap, retry, and refresh races. Partial unique on (sender_account_id, send_intent_id). Nullable for historical rows that predate Bridge 99.';

-- ---------------------------------------------------------------------------
-- Part D · nex_account_risk_signal · risk-service-owned storage
-- ---------------------------------------------------------------------------
-- Sealed §7A: fingerprint and future risk signals live here, NOT on
-- nex_account. Founder v3 review specifically moved fingerprint off
-- the identity anchor to prevent the future-regression trap where a
-- developer accidentally writes
--
--     SELECT id FROM nex_account WHERE provisional_fingerprint = ?
--
-- for account lookup. That silent cross-actor merge is the exact
-- privacy hazard §7A prohibits (see A3 acceptance test).
--
-- Access model: RLS enabled with NO authenticated-role policies. Only
-- service-role (Supabase pattern) can read/write. In application code,
-- ONLY risk-service.ts imports this table. Every other module MUST NOT
-- query it. That includes provisional-account-service.ts (the service
-- that resolves identity), which stays strictly separated per §7B.
--
-- No unique constraint on provisional_fingerprint. Enforcing uniqueness
-- would silently attach a second visitor sharing the same NAT/browser/
-- timezone to the first visitor's row — the prohibited behaviour. The
-- non-unique index below serves risk-scoring queries ("how many
-- provisional accounts share this fingerprint in the last hour?").

CREATE TABLE IF NOT EXISTS nex_account_risk_signal (
  account_id                    uuid PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE,
  provisional_fingerprint       text NULL,
  fingerprint_last_computed_at  timestamptz NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_account_risk_signal_fp
  ON nex_account_risk_signal (provisional_fingerprint, created_at)
  WHERE provisional_fingerprint IS NOT NULL;

ALTER TABLE nex_account_risk_signal ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granted to authenticated role. Only
-- service-role (used exclusively by risk-service.ts) may read/write.
-- If a future PR adds an authenticated-role policy here, that is a
-- doctrinal violation and must be blocked.

COMMENT ON TABLE nex_account_risk_signal IS
  'Bridge 99 · Founder-sealed 2026-09-30. Risk-signal storage OWNED BY THE RISK SERVICE. MUST NOT be joined against for identity resolution, account lookup, authentication, or recovery. Separated from nex_account to prevent the structural regression trap identified in v3 founder review (§5, §7A). Access restricted to service-role via absence of authenticated RLS policies.';

COMMENT ON COLUMN nex_account_risk_signal.provisional_fingerprint IS
  'Bridge 99. Salted hash of narrow, whitelisted device signals (see §7A). Contributes to abuse/velocity scoring only. NEVER a resolver input · silent cross-actor merging is prohibited (§7A false-positives). No unique constraint deliberately. Cleared on claim.';

-- ---------------------------------------------------------------------------
-- Part E · nex_session_registry · server-side session_id revocation
-- ---------------------------------------------------------------------------
-- Sealed §7 Cookie contract requires:
--   · nex_session cookie signed over {account_id, session_id, issued_at,
--     expires_at} with rotating HMAC.
--   · Server-side revocation MUST operate on session_id, not on account.
--   · Validity: signature_matches AND now < expires_at AND session_id
--     NOT IN revoked_sessions.
--
-- This table is the "revoked_sessions" store — but modelled positively
-- as the full session registry so that:
--   · /settings/reset-cover-continuity can revoke the specific
--     presented session_id.
--   · A future security page can list "your active NEX sessions" per
--     account.
--   · Signing-key rotation can mass-revoke by walking the registry.
--   · Session activity (last_seen_at) is observable for abuse response,
--     WITHOUT that observation resetting the account's abandonment
--     timer (which is a §7B rule, enforced in application code).
--
-- Access model: same as Part D. RLS enabled, no authenticated policies.
-- Only service-role validates cookies against this table. Clients never
-- query it directly.
--
-- A revoked session is one where revoked_at IS NOT NULL. The application-
-- layer validity check is:
--
--     SELECT revoked_at, expires_at
--       FROM nex_session_registry
--      WHERE session_id = $sid
--        AND account_id = $account_id_from_signed_payload;
--     -- reject if row missing, revoked_at NOT NULL, or now() >= expires_at

CREATE TABLE IF NOT EXISTS nex_session_registry (
  session_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz NULL,
  revoked_reason   text NULL CHECK (
    revoked_reason IS NULL OR revoked_reason IN (
      'user_reset_cover_continuity',
      'admin_revoke',
      'signing_key_rotated',
      'account_deleted',
      'expired_cleanup'
    )
  ),
  CONSTRAINT nex_session_registry_revoked_consistency
    CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),
  -- Founder review 2026-09-30: database-level invariant that a session
  -- cannot expire before it was issued. Application should never create
  -- this state; DB enforces it as a hardening layer.
  CONSTRAINT nex_session_registry_expiry_after_issue
    CHECK (expires_at > issued_at)
);

-- Fast per-account session listing (future "your active sessions" UI).
CREATE INDEX IF NOT EXISTS idx_nex_session_registry_account
  ON nex_session_registry (account_id, issued_at DESC);

-- (No explicit index on (session_id) — the PRIMARY KEY already provides
--  a unique b-tree index on session_id. The hot validity-check path
--  SELECT ... WHERE session_id = $sid AND account_id = $aid uses that
--  PK index for the equality lookup and filters revoked_at/expires_at
--  from the returned row. A partial-on-(session_id) index adds no
--  planner benefit for this pattern and was removed after founder
--  review 2026-09-30.)

-- Expiry-cleanup index: supports cron discovery of sessions whose
-- expires_at has passed and which have not yet been revoked/cleaned.
-- The partial WHERE revoked_at IS NULL scopes the index to the set of
-- rows the cleanup pass cares about (revoked rows are already handled
-- by other paths and would only bloat the index).
CREATE INDEX IF NOT EXISTS idx_nex_session_registry_expiry
  ON nex_session_registry (expires_at ASC)
  WHERE revoked_at IS NULL;

ALTER TABLE nex_session_registry ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granted to authenticated role. Session
-- validity is checked server-side by service-layer code using
-- service-role, never by RLS-based direct queries from clients.

COMMENT ON TABLE nex_session_registry IS
  'Bridge 99 · Founder-sealed 2026-09-30. Server-side session-instance registry backing the nex_session cookie contract in §7. Every issued nex_session has a row here. Revocation sets revoked_at + revoked_reason. Validity check: session_id present AND revoked_at IS NULL AND now() < expires_at. Access restricted to service-role via absence of authenticated RLS policies.';

COMMENT ON COLUMN nex_session_registry.session_id IS
  'Per-credential-instance identifier. Included in the signed cookie payload alongside account_id + issued_at + expires_at. Distinct from account_id: revoking one session_id must not invalidate every session for the same account.';

COMMENT ON COLUMN nex_session_registry.revoked_at IS
  'Bridge 99. When non-NULL, the session_id is invalid regardless of signature/expiry. /settings/reset-cover-continuity writes this. Signing-key rotation may bulk-write it.';

-- ---------------------------------------------------------------------------
-- Migration ledger
-- ---------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '102',
    'Bridge 99 · First Conversation Principle · provisional state + risk signal + session registry + send idempotency',
    'Founder-sealed doctrine 2026-09-30 (sealed baseline: git commit 6566ace3, docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md v5). Parts A-E. Part A: nex_account.claimed_at (identity lifecycle). Part B: nex_peer_conversation.origin_cover_business_id (conversation provenance). Part C: nex_peer_message.send_intent_id + UNIQUE (sender_account_id, send_intent_id) (send idempotency; column-name clarified against live schema per Boundary #1). Part D: nex_account_risk_signal table (risk-service-owned; no authenticated RLS policies). Part E: nex_session_registry table (per-jti revocation backing §7 cookie contract; no authenticated RLS policies) with (a) revoked-consistency CHECK, (b) expiry-after-issue CHECK added on founder review 2026-09-30. Redundant partial (session_id) index removed on same review (PK already covers). Bridge 3 peer_message RLS defect deliberately NOT repaired here (see Boundary #3 · follow-up B99+rls-harden).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (run these SELECTs · not part of the migration):
--
--   -- Ledger row present
--   SELECT * FROM nex_migration_history WHERE version = '102';
--
--   -- Part A · nex_account.claimed_at
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_account' AND column_name = 'claimed_at';
--   -- expect: claimed_at / timestamp with time zone / YES
--
--   -- Part B · nex_peer_conversation.origin_cover_business_id
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_peer_conversation'
--      AND column_name = 'origin_cover_business_id';
--   -- expect: origin_cover_business_id / uuid / YES
--
--   -- Part C · nex_peer_message.send_intent_id + partial unique index
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_peer_message' AND column_name = 'send_intent_id';
--   -- expect: send_intent_id / uuid / YES
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_peer_message'
--      AND indexname = 'uq_nex_peer_message_send_intent';
--   -- expect: one row
--
--   -- Part D · nex_account_risk_signal table + zero authenticated policies
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'nex_account_risk_signal';
--   -- expect: one row
--   SELECT count(*) FROM pg_policies
--    WHERE tablename = 'nex_account_risk_signal';
--   -- expect: 0 (no authenticated policies · service-role only access)
--
--   -- Part E · nex_session_registry table + zero authenticated policies
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'nex_session_registry';
--   -- expect: one row
--   SELECT count(*) FROM pg_policies
--    WHERE tablename = 'nex_session_registry';
--   -- expect: 0 (no authenticated policies · service-role only access)
--
--   -- Part E · both CHECK constraints present
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_session_registry'::regclass
--      AND contype = 'c'
--    ORDER BY conname;
--   -- expect: nex_session_registry_expiry_after_issue,
--   --         nex_session_registry_revoked_consistency,
--   --         (plus PostgreSQL's internal CHECK on revoked_reason enum values)
--
--   -- Part E · confirm the redundant partial (session_id) index is NOT present
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_session_registry'
--    ORDER BY indexname;
--   -- expect: nex_session_registry_pkey,
--   --         idx_nex_session_registry_account,
--   --         idx_nex_session_registry_expiry
--   -- (idx_nex_session_registry_active_lookup MUST NOT be present)
--
-- ============================================================================
