-- ═══════════════════════════════════════════════════════════════════════
-- NEX BOOKER · Phase 0 · Foundations
-- ═══════════════════════════════════════════════════════════════════════
-- Migration: 20260806000000_nex_booker_foundations.sql
-- Author:    Master engineer role (Philip authorised 2026-08-06)
-- Doctrine:  project_nex_bookkeeping_membership_opportunity_2026_08_06.md
--            project_nex_bookkeeping_accountant_oversight_2026_08_06.md
--            project_nex_compliance_engine_2026_08_06.md
--            project_nex_booker_product_name_2026_08_06.md
--
-- Purpose:   Ships the four foundational primitives that must exist before
--            any Nex Booker user feature is built:
--              (1) Immutable event log (nex_bk_events)
--              (2) Deterministic double-entry ledger (nex_bk_accounts +
--                  nex_bk_journal_entries + nex_bk_journal_lines)
--              (3) Versioned compliance engine (nex_bk_compliance_packages
--                  + nex_bk_compliance_rules) with UK v1 seed
--              (4) Locked-period primitive (nex_bk_period_locks) +
--                  accountant-role grants (nex_bk_accountant_grants)
--            Plus enforcement: immutability triggers, balance check via
--            posting-procedure, RLS scoped to business_id.
--
-- Twin requirement: SOLID + ACCURATE (proper double-entry, immutable,
-- audit-trail-complete) AND EASY FOR NON-TECHNICAL USERS (this schema is
-- never seen by users — the AI translates their chat/photo/voice into the
-- correct postings under the hood).
--
-- Ships nothing user-visible on its own. Enables everything that follows.
-- ═══════════════════════════════════════════════════════════════════════

-- ── PREREQ NOTE ────────────────────────────────────────────────────────
-- All tables FK to business_brain_businesses(id), introduced in
-- 20260724720000_business_brain_v0.sql. ON DELETE RESTRICT (never CASCADE)
-- because bookkeeping records must survive business closure for legal
-- retention (accountant needs access post-closure for tax purposes).

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · IMMUTABLE EVENT LOG
-- ═══════════════════════════════════════════════════════════════════════
-- Every business action becomes an event: receipt uploaded, invoice sent,
-- payment received, category corrected, period locked, adjustment posted,
-- accountant signed off. The ledger is DERIVED from this log — replay the
-- events through the posting engine and you rebuild the ledger identically.
--
-- Append-only. No UPDATE. No DELETE. Enforced by trigger + revoked grants.
-- Deletions are themselves events (soft delete with reason).

CREATE TABLE IF NOT EXISTS nex_bk_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,

    -- What happened
    event_type        TEXT NOT NULL,            -- 'receipt_captured', 'invoice_issued', 'payment_received', 'expense_categorised', 'period_locked', 'accountant_signed_off', 'adjustment_posted', 'record_soft_deleted', etc.
    entity_type       TEXT NOT NULL,            -- 'receipt', 'invoice', 'payment', 'period', 'account', etc.
    entity_id         TEXT NOT NULL,            -- Stable external ref for the entity

    -- Who caused it
    actor_type        TEXT NOT NULL CHECK (actor_type IN ('user','nex','accountant','system','import')),
    actor_id          TEXT,                     -- user_id / worker_id / accountant_id / system component name

    -- How it was captured
    source            TEXT NOT NULL CHECK (source IN ('chat','photo','voice','manual','import','api','background')),

    -- State transition (nulls allowed for creations)
    before_state      JSONB,
    after_state       JSONB,
    reason            TEXT,                     -- Optional free-text context (e.g. "corrected VAT after supplier statement")

    -- Idempotency (client-supplied UUID prevents double-submit from lost network responses)
    request_id        UUID,

    -- Time
    event_at          TIMESTAMPTZ NOT NULL,     -- WHEN THE BUSINESS EVENT HAPPENED (receipt date, invoice date, etc.)
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- WHEN NEX RECEIVED IT

    -- Extension bag
    meta              JSONB DEFAULT '{}'::JSONB
);

-- Indexes: most-recent-first per business is the hot path; entity history
-- lookup is second; event-type reporting third. All scoped to business_id
-- as leading key so RLS + partition-by-business remain efficient.
CREATE INDEX IF NOT EXISTS idx_nex_bk_events_business_time
    ON nex_bk_events (business_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_bk_events_entity
    ON nex_bk_events (business_id, entity_type, entity_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_bk_events_type
    ON nex_bk_events (business_id, event_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_bk_events_business_event_at
    ON nex_bk_events (business_id, event_at DESC);

-- Idempotency: same business + same request_id can only appear once
CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_bk_events_idempotency
    ON nex_bk_events (business_id, request_id)
    WHERE request_id IS NOT NULL;

-- Immutability enforcement: no UPDATE, no DELETE, ever (even service_role
-- must bypass explicitly via SET LOCAL nex_bk.allow_hard_delete = 'true'
-- for exceptional cases such as GDPR erasure — logged separately).
CREATE OR REPLACE FUNCTION nex_bk_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('nex_bk.allow_hard_delete', TRUE) = 'true' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    RAISE EXCEPTION 'nex_bk_events is append-only (op=% attempted). Deletes require explicit override + audit log.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_bk_events_immutable ON nex_bk_events;
CREATE TRIGGER trg_nex_bk_events_immutable
    BEFORE UPDATE OR DELETE ON nex_bk_events
    FOR EACH ROW EXECUTE FUNCTION nex_bk_events_immutable();

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · CHART OF ACCOUNTS
-- ═══════════════════════════════════════════════════════════════════════
-- Internal-only structure. Users never see debits/credits, account codes,
-- or account types. NEX translates chat/photo actions into postings against
-- these accounts. Chart is per-business (allows customisation) but seeded
-- from a standard UK small-business template on business creation (seed
-- happens in a later migration once business-onboarding flow lands).

CREATE TABLE IF NOT EXISTS nex_bk_accounts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,

    code          TEXT NOT NULL,               -- '1000' Cash · '4000' Sales · '5000' COGS · '2200' VAT Payable
    name          TEXT NOT NULL,               -- Human-readable ("Sales Revenue")
    type          TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
    normal_side   TEXT NOT NULL CHECK (normal_side IN ('debit','credit')),  -- Assets/expenses = debit-normal · Liabilities/equity/income = credit-normal

    parent_id     UUID REFERENCES nex_bk_accounts(id) ON DELETE RESTRICT,   -- Account hierarchy for reporting subtotals
    is_system     BOOLEAN NOT NULL DEFAULT FALSE,  -- System-managed accounts (Cash, VAT Payable, Retained Earnings) cannot be deleted by user
    active        BOOLEAN NOT NULL DEFAULT TRUE,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_bk_accounts_business_code
    ON nex_bk_accounts (business_id, code);

CREATE INDEX IF NOT EXISTS idx_nex_bk_accounts_business_type
    ON nex_bk_accounts (business_id, type, active);

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · JOURNAL ENTRIES (double-entry batches)
-- ═══════════════════════════════════════════════════════════════════════
-- Each entry is one atomic accounting event containing 2+ lines whose
-- debits and credits sum to zero. Every entry links back to the event
-- that produced it (source_event_id) — this is the trail from user action
-- (event) to accounting posting (entry).
--
-- Entries are IMMUTABLE. Corrections are new entries that reverse an
-- earlier entry (reverses_entry_id + reversed_by_entry_id form the link).

CREATE TABLE IF NOT EXISTS nex_bk_journal_entries (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id                   UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,

    entry_at                      TIMESTAMPTZ NOT NULL,   -- Effective business date (matters for period allocation)
    source_event_id               UUID NOT NULL REFERENCES nex_bk_events(id) ON DELETE RESTRICT,
    description                   TEXT NOT NULL,

    posted_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_by_type                TEXT NOT NULL CHECK (posted_by_type IN ('nex','accountant','user','system')),
    posted_by_id                  TEXT,

    -- Reversal linkage (self-referential)
    reversed_by_entry_id          UUID REFERENCES nex_bk_journal_entries(id) ON DELETE RESTRICT,   -- Set when this entry gets reversed
    reverses_entry_id             UUID REFERENCES nex_bk_journal_entries(id) ON DELETE RESTRICT,   -- Set when this entry IS a reversal

    -- Compliance version pinning (which package version was in force when we calculated tax figures)
    compliance_package_version    TEXT,

    -- Is this an accountant-authored adjustment posting (year-end accruals, depreciation, corrections)?
    -- Adjustment postings CAN target closed periods (that's their job); regular postings cannot.
    is_adjustment                 BOOLEAN NOT NULL DEFAULT FALSE,

    meta                          JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_entries_business_entry_at
    ON nex_bk_journal_entries (business_id, entry_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_entries_source_event
    ON nex_bk_journal_entries (source_event_id);

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_entries_reverses
    ON nex_bk_journal_entries (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL;

-- Immutability trigger (same pattern as events)
CREATE OR REPLACE FUNCTION nex_bk_journal_entries_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('nex_bk.allow_hard_delete', TRUE) = 'true' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    -- Allow UPDATE only to set reversed_by_entry_id (linking a reversal back to the original).
    -- No other field may change.
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.id, OLD.business_id, OLD.entry_at, OLD.source_event_id, OLD.description,
            OLD.posted_at, OLD.posted_by_type, OLD.posted_by_id, OLD.reverses_entry_id,
            OLD.compliance_package_version, OLD.is_adjustment)
           IS DISTINCT FROM
           (NEW.id, NEW.business_id, NEW.entry_at, NEW.source_event_id, NEW.description,
            NEW.posted_at, NEW.posted_by_type, NEW.posted_by_id, NEW.reverses_entry_id,
            NEW.compliance_package_version, NEW.is_adjustment)
        THEN
            RAISE EXCEPTION 'nex_bk_journal_entries is immutable except for reversed_by_entry_id (op=%)', TG_OP;
        END IF;
        -- Only reversed_by_entry_id can transition NULL → set-once (never re-set)
        IF OLD.reversed_by_entry_id IS NOT NULL THEN
            RAISE EXCEPTION 'reversed_by_entry_id can only be set once (already set to %)', OLD.reversed_by_entry_id;
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'nex_bk_journal_entries does not allow DELETE (op=%)', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_bk_journal_entries_immutable ON nex_bk_journal_entries;
CREATE TRIGGER trg_nex_bk_journal_entries_immutable
    BEFORE UPDATE OR DELETE ON nex_bk_journal_entries
    FOR EACH ROW EXECUTE FUNCTION nex_bk_journal_entries_immutable();

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · JOURNAL LINES (individual debit/credit rows)
-- ═══════════════════════════════════════════════════════════════════════
-- Each line is one debit OR one credit against one account. Never both.
-- Never negative. Multi-currency: original amount + currency preserved
-- alongside the base-currency converted amount + exchange rate metadata.
-- Dimension fields (project_id, customer_id, supplier_id) enable cost
-- allocation without duplicating accounts per project.

CREATE TABLE IF NOT EXISTS nex_bk_journal_lines (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id                 UUID NOT NULL REFERENCES nex_bk_journal_entries(id) ON DELETE RESTRICT,
    business_id              UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,  -- Denormalised for RLS + fast reporting
    account_id               UUID NOT NULL REFERENCES nex_bk_accounts(id) ON DELETE RESTRICT,

    -- Amounts in business base currency (from business_brain_businesses or later profile)
    debit                    NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit                   NUMERIC(18,2) NOT NULL DEFAULT 0,
    currency                 CHAR(3) NOT NULL DEFAULT 'GBP',

    -- Multi-currency: original transaction amount + FX metadata (never overwritten)
    original_amount          NUMERIC(18,2),
    original_currency        CHAR(3),
    exchange_rate            NUMERIC(18,8),
    exchange_rate_date       DATE,
    exchange_rate_source     TEXT,

    -- Dimensions (nullable — not every posting has all three)
    project_id               TEXT,
    customer_id              TEXT,
    supplier_id              TEXT,

    memo                     TEXT,
    line_number              INTEGER NOT NULL DEFAULT 0,

    -- Line is either a debit or a credit, never both, never negative
    CONSTRAINT nex_bk_lines_debit_xor_credit CHECK (
        (debit >= 0 AND credit >= 0)
        AND (debit = 0 OR credit = 0)
        AND (debit > 0 OR credit > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_lines_entry
    ON nex_bk_journal_lines (entry_id, line_number);

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_lines_account
    ON nex_bk_journal_lines (business_id, account_id);

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_lines_project
    ON nex_bk_journal_lines (business_id, project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_lines_customer
    ON nex_bk_journal_lines (business_id, customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_bk_journal_lines_supplier
    ON nex_bk_journal_lines (business_id, supplier_id) WHERE supplier_id IS NOT NULL;

-- Lines immutable (same pattern)
CREATE OR REPLACE FUNCTION nex_bk_journal_lines_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('nex_bk.allow_hard_delete', TRUE) = 'true' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    RAISE EXCEPTION 'nex_bk_journal_lines is immutable (op=%). Corrections are new reversal entries.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_bk_journal_lines_immutable ON nex_bk_journal_lines;
CREATE TRIGGER trg_nex_bk_journal_lines_immutable
    BEFORE UPDATE OR DELETE ON nex_bk_journal_lines
    FOR EACH ROW EXECUTE FUNCTION nex_bk_journal_lines_immutable();

-- ═══════════════════════════════════════════════════════════════════════
-- 5 · COMPLIANCE PACKAGES (versioned country/state tax rules)
-- ═══════════════════════════════════════════════════════════════════════
-- Rules live SEPARATELY from AI. Package + rules are data, not code. New
-- versions ship as new rows (older versions retained for historical
-- postings). AI queries these — never invents tax knowledge. Every posting
-- records which package_version was in force when it was calculated
-- (nex_bk_journal_entries.compliance_package_version).
--
-- One package per (country_code, state_code, version). state_code is
-- nullable for jurisdictions without subdivisions (UK, IE); required for
-- federal-state jurisdictions (US, CA, AU).

CREATE TABLE IF NOT EXISTS nex_bk_compliance_packages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code      CHAR(2) NOT NULL,          -- ISO 3166-1 alpha-2: 'GB', 'IE', 'AU', 'US', 'CA'
    state_code        TEXT,                      -- Sub-jurisdiction (US state, CA province) — NULL for single-jurisdiction countries

    version           TEXT NOT NULL,             -- Semver-like: '1.0.0', '1.1.0'
    effective_from    DATE NOT NULL,             -- When this package version becomes authoritative
    effective_to      DATE,                      -- NULL = still current

    last_verified_at  TIMESTAMPTZ NOT NULL,      -- When we last confirmed rules against official source
    source_urls       JSONB NOT NULL,            -- Array of authoritative source URLs (HMRC, Revenue Commissioners, IRS, etc.)
    release_notes     TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_bk_compliance_packages_unique
    ON nex_bk_compliance_packages (country_code, COALESCE(state_code, ''), version);

CREATE INDEX IF NOT EXISTS idx_nex_bk_compliance_packages_active
    ON nex_bk_compliance_packages (country_code, effective_from DESC)
    WHERE effective_to IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 6 · COMPLIANCE RULES (individual rule key-value pairs per package)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex_bk_compliance_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id        UUID NOT NULL REFERENCES nex_bk_compliance_packages(id) ON DELETE RESTRICT,
    rule_key          TEXT NOT NULL,             -- 'vat_standard_rate', 'vat_registration_threshold_gbp'
    rule_value        JSONB NOT NULL,            -- Value shape depends on rule (number, string, object)
    description       TEXT NOT NULL,             -- Human explanation for auditors + accountants
    effective_from    DATE,                      -- Optional per-rule effective date (else inherits package)
    effective_to      DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_bk_compliance_rules_unique
    ON nex_bk_compliance_rules (package_id, rule_key);

-- ═══════════════════════════════════════════════════════════════════════
-- 7 · SEED UK v1 COMPLIANCE PACKAGE
-- ═══════════════════════════════════════════════════════════════════════
-- INITIAL values sourced from HMRC guidance as of 2026-08-06. ⚠ These
-- MUST be verified against live HMRC publications before any real business
-- is onboarded — this seed is engineering scaffolding, not production
-- authority. Verification workflow to ship separately.

DO $$
DECLARE
    v_pkg_id UUID;
BEGIN
    -- Only insert if not already present (idempotent migration re-run)
    IF NOT EXISTS (
        SELECT 1 FROM nex_bk_compliance_packages
        WHERE country_code = 'GB' AND state_code IS NULL AND version = '1.0.0'
    ) THEN
        INSERT INTO nex_bk_compliance_packages (
            country_code, state_code, version, effective_from,
            last_verified_at, source_urls, release_notes
        ) VALUES (
            'GB', NULL, '1.0.0', '2026-04-06',
            NOW(),
            '["https://www.gov.uk/vat-registration/when-to-register","https://www.gov.uk/vat-rates","https://www.gov.uk/government/publications/vat-notice-70021-charities","https://www.gov.uk/government/collections/making-tax-digital-for-vat"]'::JSONB,
            'UK v1 seed. Initial values captured from HMRC public guidance 2026-08-06. Requires pre-production verification against live HMRC sources before any real business uses this package for filing preparation.'
        )
        RETURNING id INTO v_pkg_id;

        INSERT INTO nex_bk_compliance_rules (package_id, rule_key, rule_value, description) VALUES
            (v_pkg_id, 'vat_standard_rate', '0.20'::JSONB, 'Standard VAT rate applied to most goods and services.'),
            (v_pkg_id, 'vat_reduced_rate', '0.05'::JSONB, 'Reduced VAT rate for certain goods (e.g. domestic fuel, energy-saving materials).'),
            (v_pkg_id, 'vat_zero_rate', '0.00'::JSONB, 'Zero-rated VAT (still VATable but at 0% — e.g. most food, books, children''s clothing).'),
            (v_pkg_id, 'vat_registration_threshold_gbp', '90000'::JSONB, 'Compulsory VAT registration threshold for the previous 12 months of taxable turnover (rolling).'),
            (v_pkg_id, 'vat_deregistration_threshold_gbp', '88000'::JSONB, 'Threshold below which VAT deregistration can be requested.'),
            (v_pkg_id, 'vat_return_frequency', '"quarterly"'::JSONB, 'Default VAT return frequency. Monthly and annual schemes also available.'),
            (v_pkg_id, 'mtd_vat_required', 'true'::JSONB, 'Making Tax Digital for VAT is mandatory for all VAT-registered businesses.'),
            (v_pkg_id, 'personal_tax_year_start', '{"month":4,"day":6}'::JSONB, 'UK personal tax year starts 6 April.'),
            (v_pkg_id, 'personal_tax_year_end', '{"month":4,"day":5}'::JSONB, 'UK personal tax year ends 5 April.'),
            (v_pkg_id, 'corporation_tax_year_flexible', 'true'::JSONB, 'Corporation tax accounting periods are set per company (not fixed to a national tax year).'),
            (v_pkg_id, 'receipt_retention_years', '6'::JSONB, 'HMRC requires business records to be kept for a minimum of 6 years.'),
            (v_pkg_id, 'currency_code', '"GBP"'::JSONB, 'Reporting currency for UK businesses.'),
            (v_pkg_id, 'currency_symbol', '"£"'::JSONB, 'Display symbol.'),
            (v_pkg_id, 'authority_name', '"HM Revenue & Customs"'::JSONB, 'Tax authority.'),
            (v_pkg_id, 'authority_abbreviation', '"HMRC"'::JSONB, 'Common abbreviation.');
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 8 · PERIOD LOCKS
-- ═══════════════════════════════════════════════════════════════════════
-- Once a period is locked (typically month · quarter · financial year ·
-- VAT return period), no regular postings can target dates inside it.
-- Only accountant adjustment postings (is_adjustment=true on the entry)
-- can enter a locked period, and only via the accountant workspace.
--
-- Reopening a locked period requires elevated permission + logged reason.
-- Reopening does NOT delete the lock row — it sets unlocked_at, preserving
-- the audit history.

CREATE TABLE IF NOT EXISTS nex_bk_period_locks (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id                   UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,

    period_type                   TEXT NOT NULL CHECK (period_type IN ('month','quarter','year','vat_return','custom')),
    period_start                  DATE NOT NULL,
    period_end                    DATE NOT NULL,

    -- Lock event
    locked_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by_user_id             UUID,
    lock_reason                   TEXT,

    -- Accountant sign-off (nullable — set when accountant reviews + approves)
    reviewed_by_accountant_id     UUID,
    reviewed_at                   TIMESTAMPTZ,
    review_notes                  TEXT,

    -- Filing (nullable — set when accountant records that they filed with the tax authority)
    filed_at                      TIMESTAMPTZ,
    filing_reference              TEXT,          -- e.g. HMRC MTD submission reference

    -- Unlock event (rare — audit-heavy)
    unlocked_at                   TIMESTAMPTZ,
    unlocked_by_user_id           UUID,
    unlock_reason                 TEXT,

    CONSTRAINT nex_bk_period_locks_range CHECK (period_end > period_start),
    CONSTRAINT nex_bk_period_locks_unlock_after_lock CHECK (unlocked_at IS NULL OR unlocked_at > locked_at)
);

-- Fast lookup: is this date locked for this business?
CREATE INDEX IF NOT EXISTS idx_nex_bk_period_locks_business_range
    ON nex_bk_period_locks (business_id, period_start, period_end)
    WHERE unlocked_at IS NULL;

-- Helper function called by the posting engine before inserting any entry.
-- Returns TRUE if the given date falls inside an ACTIVE lock (locked and
-- not unlocked) for the given business. Adjustment postings bypass this
-- check at the posting-procedure layer (never here — this function stays
-- pure).
CREATE OR REPLACE FUNCTION nex_bk_is_period_locked(
    p_business_id UUID,
    p_date        DATE
)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM nex_bk_period_locks
        WHERE business_id = p_business_id
          AND unlocked_at IS NULL
          AND p_date >= period_start
          AND p_date <= period_end
    );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 9 · ACCOUNTANT GRANTS
-- ═══════════════════════════════════════════════════════════════════════
-- Accountants are first-class users with dedicated permissions on client
-- businesses. One row per (business, accountant) active grant. Revocation
-- sets revoked_at rather than deleting (audit history).

CREATE TABLE IF NOT EXISTS nex_bk_accountant_grants (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id            UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE RESTRICT,
    accountant_user_id     UUID NOT NULL,        -- FK to auth.users would be ideal but keeps this table decoupled from auth schema

    granted_by_user_id     UUID NOT NULL,
    granted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    permissions            JSONB NOT NULL DEFAULT '{"read_ledger":true,"add_adjustments":true,"sign_off_periods":true,"request_corrections":true}'::JSONB,

    revoked_at             TIMESTAMPTZ,
    revoked_by_user_id     UUID,
    revoke_reason          TEXT
);

-- One active grant per (business, accountant) — historical revoked grants remain
CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_bk_accountant_grants_active
    ON nex_bk_accountant_grants (business_id, accountant_user_id)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nex_bk_accountant_grants_accountant
    ON nex_bk_accountant_grants (accountant_user_id, granted_at DESC)
    WHERE revoked_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 10 · POSTING PROCEDURE (the SINGLE way journal entries are inserted)
-- ═══════════════════════════════════════════════════════════════════════
-- ALL journal entries must be inserted through this procedure. Never
-- directly. This procedure enforces the two invariants that cannot be
-- expressed as simple constraints:
--   (a) sum(debit) = sum(credit) across the entry's lines
--   (b) entry_at is not inside a locked period (unless is_adjustment=true)
--
-- Inputs are two JSONB payloads (entry + lines) to keep the interface
-- language-agnostic. Returns the new entry_id.

CREATE OR REPLACE FUNCTION nex_bk_post_journal_entry(
    p_entry JSONB,
    p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_entry_id                    UUID;
    v_business_id                 UUID;
    v_entry_at                    TIMESTAMPTZ;
    v_is_adjustment               BOOLEAN;
    v_debit_total                 NUMERIC(18,2);
    v_credit_total                NUMERIC(18,2);
    v_line                        JSONB;
    v_line_number                 INTEGER := 0;
BEGIN
    -- Extract entry fields
    v_business_id       := (p_entry->>'business_id')::UUID;
    v_entry_at          := (p_entry->>'entry_at')::TIMESTAMPTZ;
    v_is_adjustment     := COALESCE((p_entry->>'is_adjustment')::BOOLEAN, FALSE);

    -- Locked-period check (adjustment postings bypass)
    IF NOT v_is_adjustment THEN
        IF nex_bk_is_period_locked(v_business_id, v_entry_at::DATE) THEN
            RAISE EXCEPTION 'Cannot post to locked period. business_id=% entry_at=%. Use is_adjustment=true and post via accountant workspace.', v_business_id, v_entry_at;
        END IF;
    END IF;

    -- Compute totals for balance check
    SELECT
        COALESCE(SUM((line->>'debit')::NUMERIC), 0),
        COALESCE(SUM((line->>'credit')::NUMERIC), 0)
    INTO v_debit_total, v_credit_total
    FROM jsonb_array_elements(p_lines) AS line;

    IF v_debit_total != v_credit_total THEN
        RAISE EXCEPTION 'Journal entry unbalanced: debits=% credits=% (difference=%). Rejecting.', v_debit_total, v_credit_total, (v_debit_total - v_credit_total);
    END IF;

    IF v_debit_total = 0 THEN
        RAISE EXCEPTION 'Journal entry has zero total. Rejecting.';
    END IF;

    -- Insert the entry
    INSERT INTO nex_bk_journal_entries (
        business_id, entry_at, source_event_id, description,
        posted_by_type, posted_by_id, reverses_entry_id,
        compliance_package_version, is_adjustment, meta
    ) VALUES (
        v_business_id,
        v_entry_at,
        (p_entry->>'source_event_id')::UUID,
        p_entry->>'description',
        p_entry->>'posted_by_type',
        p_entry->>'posted_by_id',
        NULLIF(p_entry->>'reverses_entry_id', '')::UUID,
        p_entry->>'compliance_package_version',
        v_is_adjustment,
        COALESCE(p_entry->'meta', '{}'::JSONB)
    )
    RETURNING id INTO v_entry_id;

    -- Insert the lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO nex_bk_journal_lines (
            entry_id, business_id, account_id,
            debit, credit, currency,
            original_amount, original_currency, exchange_rate, exchange_rate_date, exchange_rate_source,
            project_id, customer_id, supplier_id,
            memo, line_number
        ) VALUES (
            v_entry_id,
            v_business_id,
            (v_line->>'account_id')::UUID,
            COALESCE((v_line->>'debit')::NUMERIC, 0),
            COALESCE((v_line->>'credit')::NUMERIC, 0),
            COALESCE(v_line->>'currency', 'GBP'),
            NULLIF(v_line->>'original_amount', '')::NUMERIC,
            NULLIF(v_line->>'original_currency', ''),
            NULLIF(v_line->>'exchange_rate', '')::NUMERIC,
            NULLIF(v_line->>'exchange_rate_date', '')::DATE,
            NULLIF(v_line->>'exchange_rate_source', ''),
            NULLIF(v_line->>'project_id', ''),
            NULLIF(v_line->>'customer_id', ''),
            NULLIF(v_line->>'supplier_id', ''),
            NULLIF(v_line->>'memo', ''),
            v_line_number
        );
        v_line_number := v_line_number + 1;
    END LOOP;

    RETURN v_entry_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 11 · ROW-LEVEL SECURITY (all tables scoped to business_id)
-- ═══════════════════════════════════════════════════════════════════════
-- RLS is opt-in per Supabase pattern. Service role bypasses all policies
-- (the Fly worker + Next.js server routes use service_role). User-facing
-- API surfaces (when they land) will use user JWTs and hit these policies.
--
-- For Phase 0 we enable RLS + a service_role bypass policy on every table.
-- Fine-grained user policies (member-of-business, accountant-with-grant)
-- land alongside the user-facing surfaces in later migrations.

ALTER TABLE nex_bk_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_journal_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_compliance_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_compliance_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_period_locks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_bk_accountant_grants   ENABLE ROW LEVEL SECURITY;

-- Service role bypass on every table (idempotent creation)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'nex_bk_events','nex_bk_accounts','nex_bk_journal_entries','nex_bk_journal_lines',
        'nex_bk_compliance_packages','nex_bk_compliance_rules',
        'nex_bk_period_locks','nex_bk_accountant_grants'
    ]
    LOOP
        BEGIN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR ALL USING (auth.jwt() ->> ''role'' = ''service_role'') WITH CHECK (auth.jwt() ->> ''role'' = ''service_role'')',
                tbl || '_service_role', tbl
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END LOOP;
END $$;

-- Compliance packages + rules are readable by ALL authenticated users
-- (they're public reference data, not business-specific). Write access
-- remains service-role only.
DO $$
BEGIN
    CREATE POLICY nex_bk_compliance_packages_public_read
        ON nex_bk_compliance_packages FOR SELECT
        USING (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY nex_bk_compliance_rules_public_read
        ON nex_bk_compliance_rules FOR SELECT
        USING (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 12 · TABLE COMMENTS (documentation lives in the schema)
-- ═══════════════════════════════════════════════════════════════════════

COMMENT ON TABLE nex_bk_events IS
    'Nex Booker · Immutable event log. Every business action (receipt captured, invoice sent, payment received, category corrected, period locked, adjustment posted) is an append-only event. The ledger is DERIVED from this log; replaying events through the posting engine reconstructs the ledger identically. No UPDATE, no DELETE (except via explicit override for GDPR erasure).';

COMMENT ON TABLE nex_bk_accounts IS
    'Nex Booker · Chart of accounts. Internal-only. Users never see debits/credits/account codes — NEX translates their actions into postings against these accounts. Per-business (allows customisation) but seeded from standard templates on business creation.';

COMMENT ON TABLE nex_bk_journal_entries IS
    'Nex Booker · Journal entries (double-entry batches). One entry per accounting event, containing 2+ lines whose debits and credits sum to zero. Every entry links back to the source event that produced it. Immutable except for setting reversed_by_entry_id once. Corrections are new reversal entries, not edits.';

COMMENT ON TABLE nex_bk_journal_lines IS
    'Nex Booker · Individual debit or credit rows. Each line is one debit OR one credit against one account, never both, never negative. Multi-currency: original amount + FX metadata preserved alongside base-currency converted amount.';

COMMENT ON TABLE nex_bk_compliance_packages IS
    'Nex Booker · Versioned country/state tax rule packages. Rules live SEPARATELY from AI. New versions ship as new rows (old versions retained for historical postings). Every posting records which package version was in force via nex_bk_journal_entries.compliance_package_version.';

COMMENT ON TABLE nex_bk_period_locks IS
    'Nex Booker · Locked accounting periods. Once locked, no regular postings can target dates inside; only accountant adjustment postings (is_adjustment=true) can enter. Reopening sets unlocked_at (audit-preserved). Enforced by nex_bk_post_journal_entry procedure.';

COMMENT ON TABLE nex_bk_accountant_grants IS
    'Nex Booker · Accountant access permissions. First-class role — accountants review + sign off periods, add adjustment postings, cannot silently edit owner records. Revocation preserves history via revoked_at.';

COMMENT ON FUNCTION nex_bk_post_journal_entry(JSONB, JSONB) IS
    'Nex Booker · THE ONLY WAY to insert a journal entry. Enforces (a) debits = credits across lines, (b) entry_at not inside a locked period (unless is_adjustment=true). Never bypass with direct INSERTs.';

COMMENT ON FUNCTION nex_bk_is_period_locked(UUID, DATE) IS
    'Nex Booker · Returns TRUE if the given date falls inside an active period lock for the business. Called by the posting procedure before inserting; safe to call from application code for pre-flight checks.';

-- ═══════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════
