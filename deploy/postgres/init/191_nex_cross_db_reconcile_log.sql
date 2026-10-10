-- 191_nex_cross_db_reconcile_log.sql
--
-- NEX Directory · Cross-DB Reconciler · audit log table.
-- Pilot of the cross-DB owner-link reconciler sketched in
-- docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md §5.4.
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.cross_db_reconcile_log` · a durable, append-only audit
--   trail for every invocation of the cross-DB reconciler (the module
--   that, once activated by the operator, syncs the NEX-side canonical
--   ownership state into the Supabase `nex_business.canonical_business_id`
--   soft reference).
--
--   One row per reconcile attempt. The reconciler lives at
--   `src/lib/nex-native/cross-db-reconciler/reconciler.ts` and is gated
--   OFF by default via the `NEX_CROSS_DB_RECONCILER_ENABLED` env var.
--   When enabled, the service defaults to simulate-only mode (writes
--   `simulated = TRUE` audit rows but makes zero real Supabase calls)
--   until the operator also sets `NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY=false`.
--
-- SEALED EVENT TYPES (9 states)
--   link_attempted         — reconciler fired for this (claim, canonical, account) tuple
--   link_succeeded         — Supabase UPDATE affected 1 row (idempotent re-link)
--   link_updated_existing  — same as link_succeeded but highlights the UPDATE path
--   link_created_stub      — Supabase INSERT created a new nex_business row
--   link_ambiguous         — Supabase UPDATE affected >1 row (owner has multiple nex_business rows)
--   link_failed            — Supabase call raised a non-conflict error
--   retry_scheduled        — reconciler scheduled a retry attempt
--   orphan_detected        — weekly orphan sweep flagged a VERIFIED claim with no link
--   sweep_run              — weekly orphan sweep heartbeat
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a secret store. error_detail is the sanitised string produced
--     by the sealed `sanitiseError` helper · it NEVER contains Postgres
--     passwords, Supabase service-role keys, raw connection strings, or
--     claim-code plaintext.
--   · Not a cross-DB FK. canonical_business_id FKs to nex.business_canonical
--     (NEX side only). supabase_account_id is TEXT · a soft reference
--     stored raw for operational traceability. Any export of this table
--     must hash the account id (deferred infrastructure).
--   · Not a trigger host. No triggers, no DML, no GRANT/REVOKE.
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE INDEX IF NOT EXISTS. No DML.
--   Safe to re-run · a second apply finds the table present and all
--   CREATE statements become no-ops. Writes zero rows.
--
--   Per-event idempotency is enforced at the application layer via the
--   UNIQUE (idempotency_key, attempt_number) index. The reconciler
--   composes idempotency_key as sha256(claim_id + ':' + canonical + ':' + account_id)
--   truncated to 64 chars. A duplicate recordReconcileEvent call for
--   the same key + attempt_number resolves to ON CONFLICT DO NOTHING
--   and the service returns `alreadyRecorded: true`.
--
-- ROLLBACK
--   DROP TABLE nex.cross_db_reconcile_log;
--   (No FKs point AT this table. ON DELETE SET NULL on inbound FKs
--   means a dropped claim or canonical never cascades a delete here.)
--
-- SAFE ON POPULATED DB
--   Yes. New table only. No ALTERs on nex.business_claim, no ALTERs
--   on nex.business_canonical, no DML. Zero-risk additive migration.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167 (FK target).
--   · nex.business_claim:     migration 176 (FK target).
--   · pgcrypto:               gen_random_uuid() for the PK default
--                             (loaded by 058/166).
--
-- NOT APPLIED TO PRODUCTION
--   Reconciler infrastructure is OFF by default. The applier script
--   `scripts/nex-canonical/_apply-migration-191.mjs` gates the write
--   with a session-identity check (current_database() = 'nex_dev').
--   No real Supabase call is possible from the reconciler module
--   until the operator flips BOTH NEX_CROSS_DB_RECONCILER_ENABLED=true
--   AND NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY=false.

-- ═══════════════════════════════════════════════════════════════════
-- cross_db_reconcile_log — one row per reconcile attempt
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.cross_db_reconcile_log (
  log_id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sealed 9-value event vocabulary.
  event_type                text         NOT NULL,

  -- Which NEX-side claim triggered the reconcile. Nullable because
  -- sweep_run / orphan_detected rows may fire without a specific
  -- claim id in scope.
  claim_id                  uuid         NULL,

  -- Which canonical business was being linked. Nullable for the same
  -- reason as claim_id above.
  canonical_business_id     uuid         NULL,

  -- Supabase soft reference. Opaque TEXT · stored raw for operational
  -- traceability. Any export MUST hash this field before leaving NEX.
  supabase_account_id       text         NULL,

  -- Supabase rowCount for UPDATE/INSERT paths (null for scheduling /
  -- sweep rows).
  affected_rows             integer      NULL,

  -- Short code the sanitised error path emits (e.g. 'unique_violation',
  -- 'rest_500', 'client_unavailable'). Never raw Postgres SQLSTATE
  -- leakage.
  error_code                text         NULL,

  -- sanitiseError-processed error detail string. NEVER contains
  -- credentials.
  error_detail              text         NULL,

  -- Application-level idempotency key. Composed by the reconciler as
  -- sha256(claim_id + ':' + canonical + ':' + account) truncated to
  -- 64 chars. Together with attempt_number this is the uniqueness
  -- scope.
  idempotency_key           text         NOT NULL,

  -- Pilot: all v1 events are simulated. Flipped to FALSE only when
  -- the operator sets NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY=false.
  simulated                 boolean      NOT NULL DEFAULT TRUE,

  -- Which retry attempt this row represents. 1 for the initial fire;
  -- 2, 3 for subsequent retries. Together with idempotency_key this
  -- is the uniqueness scope.
  attempt_number            integer      NOT NULL DEFAULT 1,

  created_at                timestamptz  NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_cdrl_event_type CHECK (event_type IN (
    'link_attempted',
    'link_succeeded',
    'link_updated_existing',
    'link_created_stub',
    'link_ambiguous',
    'link_failed',
    'retry_scheduled',
    'orphan_detected',
    'sweep_run'
  )),

  CONSTRAINT ck_cdrl_idempotency_key_len CHECK (
    length(idempotency_key) BETWEEN 1 AND 64
  ),

  CONSTRAINT ck_cdrl_attempt_number CHECK (
    attempt_number >= 1 AND attempt_number <= 10
  ),

  CONSTRAINT ck_cdrl_affected_rows CHECK (
    affected_rows IS NULL OR affected_rows >= 0
  ),

  CONSTRAINT ck_cdrl_error_detail_len CHECK (
    error_detail IS NULL OR length(error_detail) <= 2000
  ),

  CONSTRAINT ck_cdrl_error_code_len CHECK (
    error_code IS NULL OR length(error_code) BETWEEN 1 AND 64
  ),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_cdrl_claim
    FOREIGN KEY (claim_id)
    REFERENCES nex.business_claim (claim_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_cdrl_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE SET NULL
);

-- ─────────────── Indexes ──────────────────────────────────────

-- UNIQUE on idempotency_key per attempt · application-layer dedup.
CREATE UNIQUE INDEX IF NOT EXISTS cross_db_reconcile_log_idem_uq
  ON nex.cross_db_reconcile_log (idempotency_key, attempt_number);

-- Sweep queries: "what did we do for this claim recently?".
CREATE INDEX IF NOT EXISTS cross_db_reconcile_log_claim_idx
  ON nex.cross_db_reconcile_log (claim_id, created_at DESC);

-- Operator audit: "show me the last N events across all claims".
CREATE INDEX IF NOT EXISTS cross_db_reconcile_log_recent_idx
  ON nex.cross_db_reconcile_log (created_at DESC);

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.cross_db_reconcile_log IS
  'Audit trail for the cross-DB owner-link reconciler · one row per attempt · simulated=TRUE until operator flips NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY=false · idempotency enforced via UNIQUE (idempotency_key, attempt_number).';

COMMENT ON COLUMN nex.cross_db_reconcile_log.event_type IS
  'Sealed 9-value vocabulary · see migration header for the full list.';

COMMENT ON COLUMN nex.cross_db_reconcile_log.supabase_account_id IS
  'Supabase account id · opaque TEXT · stored raw for operational traceability · MUST be hashed before any export.';

COMMENT ON COLUMN nex.cross_db_reconcile_log.idempotency_key IS
  'sha256(claim_id + ":" + canonical + ":" + account_id) truncated to 64 chars · with attempt_number forms the application-level uniqueness scope.';

COMMENT ON COLUMN nex.cross_db_reconcile_log.simulated IS
  'TRUE while the reconciler runs in simulate-only mode · pilot default · operator must explicitly flip NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY=false to allow FALSE rows.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 191.
--
-- Downstream (191 does NOT ship these):
--   · src/lib/nex-native/cross-db-reconciler/log-service.ts
--   · src/lib/nex-native/cross-db-reconciler/reconciler.ts
--   · src/lib/nex-native/cross-db-reconciler/feature-flag.ts
--   · Weekly orphan sweep (deferred admin surface)
-- ═══════════════════════════════════════════════════════════════════
