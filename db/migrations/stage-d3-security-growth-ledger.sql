-- ============================================================================
-- Stage 1 of BUILD PLAN v1.1 · HQ Security Agent · growth ledger schema
-- ============================================================================
--
-- Founder-authorised 2026-09-11 · single AUTHORISE BUILD covers the full
-- 10-stage sequence · this file is Stage 1 substrate.
--
-- STATUS: AUTHORED · NOT YET APPLIED.
--   Application to nex_dev requires the same discipline as Stage 1a.2:
--   founder review + explicit apply authorisation. Master AI does NOT
--   apply this migration autonomously.
--
-- SCOPE:
--   - Creates nex.security_growth_ledger (Security Agent audit trail)
--   - Creates nex.security_rejection_event (rejection ledger)
--   - Zero foreign keys to production/specialist tables
--   - Zero mutation of existing production tables
--   - is_pipeline=true CHECK preserved (per ADR-0314i §9 anti-competing-substrate)
--
-- ISOLATION GUARANTEES:
--   1. New tables live in nex.* schema alongside existing Guardian ledgers
--      (nex.gate_kept_event · nex.gate_rejection_event) · distinct names
--   2. No FKs to specialist tables · knowledge_records · Supabase-mirror
--   3. is_pipeline=true on every row · Router MUST NOT query as truth
--   4. Teardown path: DROP TABLE nex.security_growth_ledger · nex.security_rejection_event
--
-- ============================================================================

BEGIN;

-- Guardrail: nex schema must exist (production baseline)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nex') THEN
    RAISE EXCEPTION 'nex schema not found. Production schema required.';
  END IF;
END $$;

-- ============================================================================
-- 1 · Security Agent growth ledger (ACCEPT events)
-- ============================================================================
-- Every ACCEPT decision appends here. REJECT decisions land in the rejection
-- ledger (below). Together these form the full Security Agent audit trail.

CREATE TABLE IF NOT EXISTS nex.security_growth_ledger (
  run_id                      uuid            PRIMARY KEY,
  agent_id                    text            NOT NULL,
  capabilities_touched        text[]          NOT NULL DEFAULT '{}',
  files_touched_count         integer         NOT NULL DEFAULT 0,
  change_reason               text            NOT NULL,
  siblings_boosted            text[]          NOT NULL DEFAULT '{}',
  invariants_preserved        text[]          NOT NULL DEFAULT '{}',
  verdict_at                  timestamptz     NOT NULL DEFAULT now(),
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT agent_id_not_empty CHECK (length(agent_id) > 0),
  CONSTRAINT change_reason_references_cap CHECK (change_reason ~ 'CAP-\d+')
);

CREATE INDEX IF NOT EXISTS idx_security_growth_ledger_agent
  ON nex.security_growth_ledger (agent_id);

CREATE INDEX IF NOT EXISTS idx_security_growth_ledger_at
  ON nex.security_growth_ledger (verdict_at);

COMMENT ON TABLE nex.security_growth_ledger IS
  'HQ Security Agent ACCEPT ledger · Stage 1 of BUILD PLAN v1.1 · PIPELINE SUBSTRATE · '
  'NOT canonical Knowledge (per ADR-0314i §9). Every NEX1/NEX2/NEX3/master-ai code '
  'change that the Security Agent ACCEPTs appends here. Founder-visible via '
  '/nex-head-quarters/security · never queried by Router as truth.';

-- ============================================================================
-- 2 · Security Agent rejection ledger (REJECT events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nex.security_rejection_event (
  event_id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                      uuid            NOT NULL,
  agent_id                    text            NOT NULL,
  rejection_code              text            NOT NULL,
  rejection_message           text            NOT NULL,
  file_path                   text            ,
  detail                      jsonb           NOT NULL DEFAULT '{}'::jsonb,
  event_at                    timestamptz     NOT NULL DEFAULT now(),
  is_pipeline                 boolean         NOT NULL DEFAULT true CHECK (is_pipeline = true),
  CONSTRAINT rejection_code_prefix CHECK (rejection_code LIKE 'sec.%'),
  CONSTRAINT agent_id_not_empty_rej CHECK (length(agent_id) > 0)
);

CREATE INDEX IF NOT EXISTS idx_security_rejection_run
  ON nex.security_rejection_event (run_id);

CREATE INDEX IF NOT EXISTS idx_security_rejection_code
  ON nex.security_rejection_event (rejection_code);

CREATE INDEX IF NOT EXISTS idx_security_rejection_agent
  ON nex.security_rejection_event (agent_id);

CREATE INDEX IF NOT EXISTS idx_security_rejection_at
  ON nex.security_rejection_event (event_at);

COMMENT ON TABLE nex.security_rejection_event IS
  'HQ Security Agent REJECT ledger · Stage 1 of BUILD PLAN v1.1 · PIPELINE SUBSTRATE · '
  'NOT canonical Knowledge. Every rejection carries its canonical sec.* code · founder-'
  'visible via /nex-head-quarters/security · never queried by Router as truth.';

-- ============================================================================
-- Isolation verification (runs inside this transaction · fails apply if broken)
-- ============================================================================

DO $$
DECLARE
  fk_count integer;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'nex'
    AND tc.table_name IN ('security_growth_ledger', 'security_rejection_event')
    AND (
      ccu.table_schema <> 'nex' OR
      ccu.table_name NOT IN ('security_growth_ledger', 'security_rejection_event')
    );
  IF fk_count > 0 THEN
    RAISE EXCEPTION 'Security Agent tables have % foreign key(s) crossing to non-pipeline tables. Isolation violation.', fk_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION QUERIES (informational · run after apply)
-- ============================================================================
--
-- 1. Verify tables:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'nex'
--      AND table_name IN ('security_growth_ledger', 'security_rejection_event');
--    Expected: 2 rows
--
-- 2. Verify is_pipeline CHECK on both tables:
--    SELECT table_name, constraint_name FROM information_schema.check_constraints
--    JOIN information_schema.constraint_table_usage USING (constraint_name)
--    WHERE table_schema='nex'
--      AND table_name IN ('security_growth_ledger', 'security_rejection_event');
--
-- 3. Verify no cross-schema FKs:
--    (see DO block above · would raise at apply time if violated)
--
-- 4. Verify CAP-XXX CHECK on growth ledger:
--    -- This INSERT should FAIL:
--    -- INSERT INTO nex.security_growth_ledger (run_id, agent_id, change_reason)
--    -- VALUES (gen_random_uuid(), 'test', 'no cap reference here');
--
-- 5. Verify sec.* prefix CHECK on rejection ledger:
--    -- This INSERT should FAIL:
--    -- INSERT INTO nex.security_rejection_event (run_id, agent_id, rejection_code, rejection_message)
--    -- VALUES (gen_random_uuid(), 'test', 'lab.wrong_prefix', 'test');
--
-- ============================================================================
-- END OF MIGRATION FILE · Stage 1 · Security Agent Growth Ledger
-- ============================================================================
