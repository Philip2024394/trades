-- Pilot instrumentation — Pilot Readiness Sprint.
--
-- Three tables, one purpose: prove the OS works end-to-end with real
-- humans by capturing measurable evidence at every stage transition.
-- Never a business feature — deleted at pilot close.
--
-- Design principles:
--   • Funnel events are additive + immutable — no updates, no deletes.
--   • Friction reports are user-authored — signed with participant token.
--   • Participants pair a merchant × homeowner × property across the
--     journey so we can measure end-to-end conversion.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Pilot participants — one row per merchant × homeowner pairing
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_pilot_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort text NOT NULL,                     -- 'pilot-1', 'pilot-2', ...
  merchant_id uuid NOT NULL,                -- hammerex_trade_off_listings.id
  homeowner_party_id uuid,                  -- os_parties.id (may not exist yet)
  property_id uuid,                          -- os_properties.id (may not exist yet)
  merchant_display_name text,
  homeowner_display_name text,
  friendly_label text,                       -- 'Redgrave × Sarah' for pilot ops
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active','paused','completed','abandoned'
  )),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_pilot_participants_cohort_idx
  ON os_pilot_participants (cohort, status);
CREATE INDEX IF NOT EXISTS os_pilot_participants_merchant_idx
  ON os_pilot_participants (merchant_id);
CREATE UNIQUE INDEX IF NOT EXISTS os_pilot_participants_uk
  ON os_pilot_participants (cohort, merchant_id, homeowner_party_id)
  WHERE homeowner_party_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Funnel events — stage transitions with time-since-previous
--    computable at read time. Enum matches the runbook stages exactly.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_pilot_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES os_pilot_participants(id) ON DELETE CASCADE,
  cohort text NOT NULL,
  stage text NOT NULL CHECK (stage IN (
    -- Merchant setup
    'merchant.onboarding_started',
    'merchant.trade_confirmed',
    'merchant.products_seeded',
    'merchant.brand_generated',
    'merchant.scope_bound',
    'merchant.tile_published',
    'merchant.onboarding_completed',
    'merchant.onboarding_abandoned',
    -- Homeowner journey
    'homeowner.tile_opened',
    'homeowner.contact_started',
    'homeowner.contact_completed',
    'homeowner.property_claimed',
    'homeowner.address_confirmed',
    'homeowner.photo_uploaded',
    'homeowner.render_completed',
    'homeowner.quote_received',
    'homeowner.quote_viewed',
    'homeowner.quote_accepted',
    'homeowner.review_posted',
    'homeowner.abandoned',
    -- Merchant delivery
    'merchant.quote_drafted',
    'merchant.quote_sent',
    'merchant.job_opened',
    'merchant.job_first_checkin',
    'merchant.job_signed_off',
    'merchant.review_response'
  )),
  merchant_id uuid,
  homeowner_party_id uuid,
  property_id uuid,
  project_id uuid,
  actor_kind text CHECK (actor_kind IN ('merchant','homeowner','system')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_pilot_funnel_events_cohort_stage_idx
  ON os_pilot_funnel_events (cohort, stage, occurred_at DESC);
CREATE INDEX IF NOT EXISTS os_pilot_funnel_events_participant_idx
  ON os_pilot_funnel_events (participant_id, occurred_at) WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_pilot_funnel_events_merchant_idx
  ON os_pilot_funnel_events (merchant_id, occurred_at DESC) WHERE merchant_id IS NOT NULL;
-- Idempotency: same (participant, stage) fires only once
CREATE UNIQUE INDEX IF NOT EXISTS os_pilot_funnel_events_uk
  ON os_pilot_funnel_events (participant_id, stage)
  WHERE participant_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Friction reports — captured in-context via the widget
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_friction_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES os_pilot_participants(id) ON DELETE SET NULL,
  cohort text NOT NULL,
  screen_id text NOT NULL,                -- e.g. 'merchant.hub', 'homeowner.contact-form'
  severity text NOT NULL DEFAULT 'confusion' CHECK (severity IN (
    'stuck','confusion','minor','positive'
  )),
  actor_kind text CHECK (actor_kind IN ('merchant','homeowner','trade','admin')),
  body text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb, -- {url, referrer, step, error}
  merchant_id uuid,
  homeowner_party_id uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_friction_reports_unresolved_idx
  ON os_friction_reports (created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS os_friction_reports_cohort_idx
  ON os_friction_reports (cohort, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS os_friction_reports_screen_idx
  ON os_friction_reports (screen_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Touch trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_pilot_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS os_pilot_participants_touch ON os_pilot_participants;
CREATE TRIGGER os_pilot_participants_touch
  BEFORE UPDATE ON os_pilot_participants
  FOR EACH ROW EXECUTE FUNCTION os_pilot_touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS — service-role only. All access through server routes.
-- ---------------------------------------------------------------------
ALTER TABLE os_pilot_participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_pilot_funnel_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_friction_reports       ENABLE ROW LEVEL SECURITY;

COMMIT;
