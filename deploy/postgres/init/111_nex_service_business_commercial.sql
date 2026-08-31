-- 111_nex_service_business_commercial.sql
--
-- NEX Commercial Substrate · Phase 1 · Philip 2026-08-27.
--
-- Adds commercial-funnel columns to nex.service_business. NO outreach code
-- ships with this migration · this is PURELY the substrate the future
-- Marketing Workforce will use. Qualification engine (deterministic, no ML)
-- populates the qualifiedX/contactable/marketing_ready ladder. Marketing
-- states beyond that (attempted/engaged/invited/trial/paid/declined) are
-- reserved for the Marketing Workforce and never set by the qualification
-- job.
--
-- Cadence doctrine (Philip 2026-08-27 · IMPORTANT): the schema does NOT
-- enforce a specific contact cadence like "every 24 hours". The workforce
-- runs 24/7 but individual businesses receive a polite, controlled cadence
-- decided by the future marketing workforce policy. `next_eligible_action_at`
-- and `marketing_cooldown_reason` store the *result* of a policy decision ·
-- they do not encode the policy itself.
--
-- Reversible:
--   BEGIN;
--     ALTER TABLE nex.service_business
--       DROP COLUMN IF EXISTS commercial_status,
--       DROP COLUMN IF EXISTS qualification_reason,
--       DROP COLUMN IF EXISTS qualified_at,
--       DROP COLUMN IF EXISTS contactable_at,
--       DROP COLUMN IF EXISTS marketing_ready_at,
--       DROP COLUMN IF EXISTS last_marketing_action_at,
--       DROP COLUMN IF EXISTS next_eligible_action_at,
--       DROP COLUMN IF EXISTS marketing_cooldown_reason,
--       DROP COLUMN IF EXISTS marketing_attempts_count,
--       DROP COLUMN IF EXISTS conversion_status;
--   COMMIT;

BEGIN;

-- ── 1. Commercial funnel state ───────────────────────────────────────────
-- 10-state ladder · MUST match scripts/nex-commercial/_commercial-states.mjs.
-- Qualification engine only writes {discovered, qualified, contactable,
-- marketing_ready}. Marketing workforce (future) owns the rest.

ALTER TABLE nex.service_business
  ADD COLUMN IF NOT EXISTS commercial_status TEXT NOT NULL DEFAULT 'discovered'
    CHECK (commercial_status IN (
      'discovered',
      'qualified',
      'contactable',
      'marketing_ready',
      'attempted',
      'engaged',
      'invited',
      'trial',
      'paid',
      'declined'
    ));

-- Structured reason for the CURRENT commercial_status · JSONB so we can
-- record every gate the row passed/failed (has_website, has_phone,
-- has_whatsapp, has_hero_image, ...) for HQ observability. The qualification
-- engine overwrites this whenever it moves the row.
ALTER TABLE nex.service_business
  ADD COLUMN IF NOT EXISTS qualification_reason JSONB;

-- Timestamps · qualification engine populates when it first promotes a row
-- to each state. Never nulled once set (audit trail).
ALTER TABLE nex.service_business
  ADD COLUMN IF NOT EXISTS qualified_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contactable_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_ready_at  TIMESTAMPTZ;

-- ── 2. Marketing workforce timing (reserved · never written by qualification) ─

-- Set by future marketing workforce · null-safe for qualification-only phase.
ALTER TABLE nex.service_business
  ADD COLUMN IF NOT EXISTS last_marketing_action_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_eligible_action_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_cooldown_reason  TEXT,
  ADD COLUMN IF NOT EXISTS marketing_attempts_count   INTEGER NOT NULL DEFAULT 0;

-- ── 3. Conversion outcome (also marketing-workforce owned) ───────────────

ALTER TABLE nex.service_business
  ADD COLUMN IF NOT EXISTS conversion_status TEXT NOT NULL DEFAULT 'none'
    CHECK (conversion_status IN (
      'none',
      'trial_started',
      'trial_ended',
      'paid',
      'churned'
    ));

-- ── 4. Indexes for funnel queries ────────────────────────────────────────

-- HQ commercial page reads counts grouped by (commercial_status, category_slug).
CREATE INDEX IF NOT EXISTS idx_service_business_commercial_status
  ON nex.service_business (commercial_status);
CREATE INDEX IF NOT EXISTS idx_service_business_commercial_by_category
  ON nex.service_business (category_slug, commercial_status);

-- Marketing workforce (future) will read next_eligible_action_at frequently
-- to find rows ready for action. Partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_service_business_next_eligible_action
  ON nex.service_business (next_eligible_action_at)
  WHERE next_eligible_action_at IS NOT NULL
    AND commercial_status = 'marketing_ready';

-- ── 5. Comments ──────────────────────────────────────────────────────────

COMMENT ON COLUMN nex.service_business.commercial_status IS
  '10-state funnel · owned by qualification engine (discovered→qualified→contactable→marketing_ready) and marketing workforce (attempted→engaged→invited→trial→paid→declined). See scripts/nex-commercial/_commercial-states.mjs.';
COMMENT ON COLUMN nex.service_business.qualification_reason IS
  'Structured reason blob from last qualification engine run · records which gates the row passed (has_website, has_phone, ...) and why the current status was chosen. For HQ observability.';
COMMENT ON COLUMN nex.service_business.next_eligible_action_at IS
  'When (if ever) this business is eligible for its next marketing action. Set by marketing workforce ONLY. Value depends on per-business cadence policy (not a global 24h rule).';

COMMIT;
