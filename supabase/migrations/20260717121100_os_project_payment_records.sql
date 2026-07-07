-- XRatedTrade OS — Payment Records (Phase 2, part 3/3).
--
-- IMPORTANT — INFORMATIONAL RECORDS ONLY.
--
-- These tables record that payments happened. XRatedTrade does NOT
-- hold customer funds, does NOT act as escrow, does NOT process
-- payments between homeowner and merchant. Fund handling requires
-- FCA authorisation (Payment Services Regulations 2017) which is out
-- of scope for this platform.
--
-- What we DO track:
--   • Payment intent (homeowner agreed to pay X on date Y)
--   • Payment confirmation (merchant marked payment as received)
--   • Payment method category (bank transfer / card / cash / other)
--   • Payment evidence document (receipt, statement)
--
-- Why we track this even without holding funds:
--   • Milestone completion evidence
--   • Cash-flow visualisation for merchants (Business Hub)
--   • Anti-fraud signal ("job completed but no payment recorded")
--   • Property Passport ("kitchen cost £X in 2027")
--   • Enterprise data (aggregated pricing intelligence for
--     manufacturers)
--
-- Every payment ROW references a milestone. Payments not tied to a
-- milestone are recorded as ad-hoc entries against the project.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_project_payment_schedules — planned payment schedule
--
-- Created from quote's payment_terms field at quote acceptance time.
-- Individual rows drive milestone creation.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES os_project_quotes(id) ON DELETE SET NULL,

  -- Schedule structure
  total_pence integer NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  schedule_type text NOT NULL
    CHECK (schedule_type IN (
      'deposit_and_final',                 -- deposit + one final payment
      'deposit_stage_final',               -- deposit + one stage + final
      'monthly_progressive',
      'weekly_progressive',
      'on_completion_only',
      'custom'
    )),

  active boolean NOT NULL DEFAULT true,
  superseded_by_id uuid REFERENCES os_project_payment_schedules(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_payment_schedules_project_idx
  ON os_project_payment_schedules (project_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS os_project_payment_schedules_quote_idx
  ON os_project_payment_schedules (quote_id) WHERE quote_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. os_project_payment_schedule_items — individual expected payments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_payment_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES os_project_payment_schedules(id) ON DELETE CASCADE,

  sequence integer NOT NULL,
  label text NOT NULL,                     -- "Deposit","Stage 1","Final"
  amount_pence integer NOT NULL,
  proportion_bps integer,                  -- basis points × 100 (5000 = 50%)
  due_at date,
  due_trigger text
    CHECK (due_trigger IN (
      'on_acceptance',
      'on_delivery',
      'on_stage_completion',
      'on_final_completion',
      'on_specific_date',
      'on_signoff'
    )),

  linked_milestone_id uuid REFERENCES os_project_milestones(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_project_payment_schedule_items_sequence_uk
    UNIQUE (schedule_id, sequence)
);

CREATE INDEX IF NOT EXISTS os_project_payment_schedule_items_schedule_idx
  ON os_project_payment_schedule_items (schedule_id, sequence);
CREATE INDEX IF NOT EXISTS os_project_payment_schedule_items_due_idx
  ON os_project_payment_schedule_items (due_at) WHERE due_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. os_project_payments — payment records (informational)
--
-- Every recorded payment. Not authoritative — platform does NOT
-- validate that money moved. Merchant marks paid; homeowner can
-- confirm; discrepancies surface as disputes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,

  -- What payment does this satisfy
  schedule_item_id uuid REFERENCES os_project_payment_schedule_items(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES os_project_milestones(id) ON DELETE SET NULL,

  -- Money
  amount_pence integer NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',

  -- Who
  from_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  to_business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE RESTRICT,

  -- How
  payment_method text NOT NULL
    CHECK (payment_method IN (
      'bank_transfer',
      'debit_card',
      'credit_card',
      'cash',
      'cheque',
      'finance',
      'invoice_terms',
      'other'
    )),
  payment_reference text,                  -- transaction ref / cheque number

  -- Confirmation (two-sided)
  merchant_confirmed_at timestamptz,
  merchant_confirmed_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  homeowner_confirmed_at timestamptz,
  homeowner_confirmed_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Evidence
  receipt_document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
  notes text,

  -- Status
  status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN (
      'recorded',                          -- one side has claimed
      'both_confirmed',                    -- both sides confirmed
      'disputed',                          -- homeowner disagrees
      'reversed'                           -- refunded / cancelled
    )),

  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_project_payments_project_idx
  ON os_project_payments (project_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS os_project_payments_business_idx
  ON os_project_payments (to_business_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS os_project_payments_from_party_idx
  ON os_project_payments (from_party_id) WHERE from_party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_payments_milestone_idx
  ON os_project_payments (milestone_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_payments_status_idx
  ON os_project_payments (status);

-- ---------------------------------------------------------------------
-- 4. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_project_payment_schedules',
      'os_project_payments'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Schedule items are effectively append-only after schedule creation.

-- ---------------------------------------------------------------------
-- 5. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_project_payment_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_payment_schedule_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_payments                 ENABLE ROW LEVEL SECURITY;

COMMIT;
