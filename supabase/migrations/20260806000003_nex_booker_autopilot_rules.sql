-- ═══════════════════════════════════════════════════════════════════════
-- NEX BOOKER · Business Autopilot rules
-- ═══════════════════════════════════════════════════════════════════════
-- Migration: 20260806000003_nex_booker_autopilot_rules.sql
-- Author:    Master engineer role (Philip authorised 2026-08-06)
-- Depends:   20260806000000_nex_booker_foundations.sql
-- Doctrine:  project_nex_business_ai_positioning_2026_08_06.md
--            (Autopilot = "owner-approved automation"; NOT full autonomy)
--            feedback_nex_business_ai_ten_principles_2026_08_06.md
--            (Principle 4: owner always in control)
--
-- Purpose:   Owner-defined rules that observe events + emit actions.
--            Rules are DATA. The engine (src/lib/nex/bookkeeping/autopilot.ts)
--            evaluates them purely — it emits PlannedActions as data;
--            it does NOT execute them. Execution is a separate layer that
--            respects each rule's mode (`suggest_only` vs `auto_execute`)
--            and requires the owner to have explicitly enabled auto-execute
--            for that rule.
--
-- Default rule mode is `suggest_only`. Owner must knowingly change mode
-- to `auto_execute` per rule — no bulk auto-enable. This is the safety
-- rail that keeps Nex Booker on the "prepared by NEX, decided by owner"
-- side of the line.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex_bk_autopilot_rules (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id           UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,

    -- Owner-facing name + optional description
    name                  TEXT NOT NULL,
    description           TEXT,

    -- What kicks the rule off. See src/lib/nex/bookkeeping/autopilot.ts
    -- for the supported trigger types + config schemas per trigger.
    trigger_type          TEXT NOT NULL,       -- 'on_receipt_captured', 'on_customer_payment', 'on_invoice_overdue_days', 'on_stock_below_min', 'on_period_ready_for_accountant', etc.
    trigger_config        JSONB NOT NULL DEFAULT '{}'::JSONB,   -- e.g. { days_overdue: 7 } for on_invoice_overdue_days

    -- Optional additional predicates. E.g. only fire for customer_id IN [...],
    -- only for amounts > X. Evaluated pure-functionally after the trigger matches.
    conditions            JSONB DEFAULT '[]'::JSONB,            -- array of {field, op, value} predicates

    -- List of planned actions to emit when the rule fires. Each action is
    -- {type: 'send_message'|'mark_invoice_paid'|..., config: {...}}.
    -- The engine emits these as data; the (separate, future) executor
    -- handles running them subject to permissions + mode.
    actions               JSONB NOT NULL DEFAULT '[]'::JSONB,

    -- Safety rail: default suggest_only. Owner must knowingly change per rule.
    mode                  TEXT NOT NULL DEFAULT 'suggest_only'
                          CHECK (mode IN ('suggest_only', 'auto_execute', 'disabled')),

    -- Provenance
    created_by_user_id    UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Runtime observability
    last_fired_at         TIMESTAMPTZ,
    last_fired_event_id   UUID,                                 -- Link to the event that most recently fired the rule
    fired_count           INTEGER NOT NULL DEFAULT 0,
    last_error            TEXT,                                 -- Set by executor when a run failed

    -- Owner notes for their own reference
    notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_nex_bk_autopilot_rules_business_trigger
    ON nex_bk_autopilot_rules (business_id, trigger_type)
    WHERE mode != 'disabled';

CREATE INDEX IF NOT EXISTS idx_nex_bk_autopilot_rules_active
    ON nex_bk_autopilot_rules (business_id, mode);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION nex_bk_autopilot_rules_touch()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_bk_autopilot_rules_touch ON nex_bk_autopilot_rules;
CREATE TRIGGER trg_nex_bk_autopilot_rules_touch
    BEFORE UPDATE ON nex_bk_autopilot_rules
    FOR EACH ROW EXECUTE FUNCTION nex_bk_autopilot_rules_touch();

-- Row-level security
ALTER TABLE nex_bk_autopilot_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY nex_bk_autopilot_rules_service_role ON nex_bk_autopilot_rules
        FOR ALL
        USING (auth.jwt() ->> 'role' = 'service_role')
        WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE nex_bk_autopilot_rules IS
    'Nex Booker · Business Autopilot. Owner-defined rules that observe events + emit actions. Rules are data — the engine returns PlannedActions; a separate executor decides whether to run them (subject to mode + owner permission). Default mode is suggest_only. auto_execute requires explicit owner opt-in per rule.';

COMMENT ON COLUMN nex_bk_autopilot_rules.mode IS
    'suggest_only (default, safe) · auto_execute (owner opt-in per rule; actions run without further approval) · disabled (rule ignored).';
