-- ═══════════════════════════════════════════════════════════════════════
-- NEX BOOKER · Phase 0 · Chart-of-accounts seeder
-- ═══════════════════════════════════════════════════════════════════════
-- Migration: 20260806000001_nex_booker_chart_seeder.sql
-- Author:    Master engineer role (Philip authorised 2026-08-06)
-- Depends:   20260806000000_nex_booker_foundations.sql
--
-- Purpose:   Ships two things:
--              (1) A function `nex_bk_seed_default_accounts(business_id)`
--                  that creates a standard UK small-business chart of
--                  accounts (~25 accounts) for one business. Idempotent —
--                  won't duplicate if accounts already exist. Called at
--                  business onboarding time by application code (via the
--                  nexBkStore().seedDefaultAccounts adapter).
--              (2) A retroactive seed pass that calls the function for
--                  every existing business_brain_businesses row so any
--                  businesses already in the system have a usable chart
--                  the moment this migration lands.
--
-- Accounts use the codes referenced by src/lib/nex/bookkeeping/posting-engine.ts
-- (ACCT.* constants). If code constants change, this seeder must change
-- in lockstep — same file, one commit.
--
-- Naming: engineering says "bookkeeping" and "chart of accounts";
-- customer-facing UI says "Nex Booker" and never shows account codes.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1 · Seeder function
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nex_bk_seed_default_accounts(p_business_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_row      RECORD;
    v_accounts CONSTANT JSONB := '[
        {"code":"1000","name":"Bank current account","type":"asset","normal_side":"debit","is_system":true},
        {"code":"1010","name":"Cash in hand","type":"asset","normal_side":"debit","is_system":true},
        {"code":"1020","name":"Savings account","type":"asset","normal_side":"debit","is_system":false},
        {"code":"1100","name":"Stock and materials on hand","type":"asset","normal_side":"debit","is_system":false},
        {"code":"1200","name":"Trade debtors","type":"asset","normal_side":"debit","is_system":true},
        {"code":"1400","name":"VAT recoverable","type":"asset","normal_side":"debit","is_system":true},
        {"code":"1500","name":"Fixed assets — tools and equipment","type":"asset","normal_side":"debit","is_system":false},
        {"code":"1510","name":"Fixed assets — vehicles","type":"asset","normal_side":"debit","is_system":false},

        {"code":"2100","name":"Trade creditors","type":"liability","normal_side":"credit","is_system":true},
        {"code":"2200","name":"VAT payable","type":"liability","normal_side":"credit","is_system":true},
        {"code":"2300","name":"PAYE and NIC payable","type":"liability","normal_side":"credit","is_system":false},
        {"code":"2400","name":"Corporation tax payable","type":"liability","normal_side":"credit","is_system":false},
        {"code":"2500","name":"Credit card","type":"liability","normal_side":"credit","is_system":false},

        {"code":"3000","name":"Owner capital","type":"equity","normal_side":"credit","is_system":true},
        {"code":"3100","name":"Owner drawings","type":"equity","normal_side":"debit","is_system":true},
        {"code":"3200","name":"Retained earnings","type":"equity","normal_side":"credit","is_system":true},

        {"code":"4000","name":"Sales revenue","type":"income","normal_side":"credit","is_system":true},
        {"code":"4100","name":"Other income","type":"income","normal_side":"credit","is_system":false},

        {"code":"5000","name":"Materials","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5100","name":"Fuel","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5200","name":"Tools","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5300","name":"Equipment hire","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5400","name":"Subcontractors","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5500","name":"Vehicle expenses","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5600","name":"Office and stationery","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5700","name":"Utilities and workshop rent","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5800","name":"Professional fees (accountant, legal, insurance)","type":"expense","normal_side":"debit","is_system":true},
        {"code":"5900","name":"Uncategorised expense","type":"expense","normal_side":"debit","is_system":true},

        {"code":"6000","name":"Wages and salaries","type":"expense","normal_side":"debit","is_system":false},
        {"code":"6100","name":"Employer NIC","type":"expense","normal_side":"debit","is_system":false},
        {"code":"6200","name":"Pension contributions","type":"expense","normal_side":"debit","is_system":false},

        {"code":"7000","name":"Depreciation","type":"expense","normal_side":"debit","is_system":false},
        {"code":"7100","name":"Bank fees and interest","type":"expense","normal_side":"debit","is_system":false},
        {"code":"7200","name":"Bad debt written off","type":"expense","normal_side":"debit","is_system":false}
    ]'::JSONB;
BEGIN
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'nex_bk_seed_default_accounts requires p_business_id';
    END IF;

    -- Idempotency: if this business already has ANY seeded accounts,
    -- skip the whole seed pass (avoids partial-seed messes). Adding new
    -- default accounts to an already-seeded business is a separate
    -- migration path, not this seeder's job.
    IF EXISTS (SELECT 1 FROM nex_bk_accounts WHERE business_id = p_business_id LIMIT 1) THEN
        RETURN 0;
    END IF;

    FOR v_row IN SELECT * FROM jsonb_array_elements(v_accounts) AS a
    LOOP
        INSERT INTO nex_bk_accounts (
            business_id, code, name, type, normal_side, is_system, active
        ) VALUES (
            p_business_id,
            v_row.value->>'code',
            v_row.value->>'name',
            v_row.value->>'type',
            v_row.value->>'normal_side',
            COALESCE((v_row.value->>'is_system')::BOOLEAN, FALSE),
            TRUE
        );
        v_inserted := v_inserted + 1;
    END LOOP;

    RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION nex_bk_seed_default_accounts(UUID) IS
    'Nex Booker · seeds the default UK small-business chart of accounts for one business. Idempotent — skips if the business already has any accounts. Call at business onboarding time. Codes referenced by src/lib/nex/bookkeeping/posting-engine.ts ACCT.* constants.';

-- ───────────────────────────────────────────────────────────────────────
-- 2 · Retroactive seed for existing businesses
-- ───────────────────────────────────────────────────────────────────────
-- Any businesses already in business_brain_businesses when this migration
-- lands get a chart of accounts created immediately. Function idempotency
-- means re-running this migration is safe.

DO $$
DECLARE
    v_biz     RECORD;
    v_seeded  INTEGER;
    v_total   INTEGER := 0;
BEGIN
    FOR v_biz IN SELECT id FROM business_brain_businesses
    LOOP
        v_seeded := nex_bk_seed_default_accounts(v_biz.id);
        v_total := v_total + v_seeded;
        IF v_seeded > 0 THEN
            RAISE NOTICE 'Nex Booker: seeded % accounts for business %', v_seeded, v_biz.id;
        END IF;
    END LOOP;
    IF v_total > 0 THEN
        RAISE NOTICE 'Nex Booker: retroactive chart seed complete — % accounts across businesses', v_total;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════
